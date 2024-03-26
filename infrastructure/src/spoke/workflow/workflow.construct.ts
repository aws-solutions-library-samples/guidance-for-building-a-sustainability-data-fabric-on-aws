/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { CfnWaitCondition, CfnWaitConditionHandle, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Choice, Condition, DefinitionBody, LogLevel, StateMachine, TaskInput, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cr from 'aws-cdk-lib/custom-resources';
import { StartExecutionInput } from '@aws-sdk/client-sfn';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export type WorkflowProps = {
  bucketName: string;
  pipelineApiFunctionName: string;
  pipelineProcessorApiFunctionName: string;
  sifAdminEmailAddress: string;
};

export class WorkflowConstruct extends Construct {
  constructor(scope: Construct, id: string, props: WorkflowProps) {
    super(scope, id);

    const pipelineLambda = NodejsFunction.fromFunctionName(this, 'PipelineLambda', props.pipelineApiFunctionName);
    const pipelineProcessorLambda = NodejsFunction.fromFunctionName(this, 'PipelineProcessorLambda', props.pipelineProcessorApiFunctionName);

    const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);

    const commonLambdaOptions = {
      bundling: {
        minify: true,
        format: OutputFormat.ESM,
        target: 'node18.16',
        sourceMap: false,
        sourcesContent: false,
        banner: 'import { createRequire } from \'module\';const require = createRequire(import.meta.url);import { fileURLToPath } from \'url\';import { dirname } from \'path\';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);',
        externalModules: ['aws-sdk', 'pg-native']
      },
      depsLockFilePath: path.join(__dirname, '../../../../common/config/rush/pnpm-lock.yaml'),
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_18_X,
      tracing: Tracing.ACTIVE,
      logRetention: RetentionDays.ONE_WEEK
    };

    const cloudformationCallback = new NodejsFunction(this, 'CloudformationCallback', {
      ...commonLambdaOptions,
      description: 'Error Handler Lambda',
      entry: path.join(__dirname, '../../../../typescript/packages/apps/workflow/src/handlers/cloudformationCallback.handler.ts'),
      functionName: `sdf-spoke-workflow-cloudformationCallback`,
      memorySize: 512,
      timeout: Duration.minutes(5),
      environment: {
        DATA_BUCKET_NAME: bucket.bucketName
      }
    });

    const region = Stack.of(this).region;
    const accountId = Stack.of(this).account;
    const stateMachinePolicy = new PolicyStatement({
      actions: [
        'states:DescribeExecution'
      ],
      resources: [
        `arn:aws:states:${region}:${accountId}:execution:sdf-demo-seeder:*`
      ]
    });

    cloudformationCallback.addToRolePolicy(stateMachinePolicy);

    const cloudformationCallbackTask = new LambdaInvoke(this, 'CloudformationCallbackTask', {
      lambdaFunction: cloudformationCallback,
      payload: TaskInput.fromObject({
        'error.$': '$',
        'execution': {
          'executionStartTime.$': '$$.Execution.StartTime',
          'executionId.$': '$$.Execution.Id',
          'stateMachineArn.$': '$$.StateMachine.Id'
        }
      }),
      outputPath: '$'
    });

    const triggerPipelineLambda = new NodejsFunction(this, 'TriggerPipelineLambda', {
      ...commonLambdaOptions,
      description: 'Trigger Pipeline Task Handler',
      entry: path.join(__dirname, '../../../../typescript/packages/apps/workflow/src/handlers/triggerPipeline.handler.ts'),
      functionName: `sdf-spoke-workflow-triggerPipeline`,
      memorySize: 512,
      timeout: Duration.minutes(5),
      environment: {
        DATA_BUCKET_NAME: bucket.bucketName,
        PIPELINE_API_FUNCTION_NAME: pipelineLambda.functionName,
        PIPELINE_PROCESSOR_API_FUNCTION_NAME: pipelineProcessorLambda.functionName,
        SIF_ADMINISTRATOR_EMAIL: props.sifAdminEmailAddress
      }
    });

    bucket.grantRead(triggerPipelineLambda);
    pipelineProcessorLambda.grantInvoke(triggerPipelineLambda);
    pipelineLambda.grantInvoke(triggerPipelineLambda);

    const triggerPipelineTask = new LambdaInvoke(this, 'TriggerPipelineTask', {
      lambdaFunction: triggerPipelineLambda,
      outputPath: '$.Payload'
    }).addCatch(cloudformationCallbackTask, {});

    const checkPipelineLambda = new NodejsFunction(this, 'CheckPipelineLambda', {
      ...commonLambdaOptions,
      description: 'Check Pipeline Task Handler',
      entry: path.join(__dirname, '../../../../typescript/packages/apps/workflow/src/handlers/checkPipeline.handler.ts'),
      functionName: `sdf-spoke-workflow-checkPipeline`,
      memorySize: 512,
      timeout: Duration.minutes(5),
      environment: {
        DATA_BUCKET_NAME: bucket.bucketName,
        PIPELINE_API_FUNCTION_NAME: pipelineLambda.functionName,
        PIPELINE_PROCESSOR_API_FUNCTION_NAME: pipelineProcessorLambda.functionName,
        SIF_ADMINISTRATOR_EMAIL: props.sifAdminEmailAddress
      }
    });

    pipelineProcessorLambda.grantInvoke(checkPipelineLambda);

    const checkPipelineTask = new LambdaInvoke(this, 'CheckPipelineTask', {
      lambdaFunction: checkPipelineLambda,
      outputPath: '$.Payload'
    }).addCatch(cloudformationCallbackTask, {});

    const sdfDemoSeederLogGroup = new LogGroup(this, 'SdfDemoSeederStateMachineLogGroup',
      { logGroupName: `/aws/vendedlogs/states/sdf-demo-seeder`, removalPolicy: RemovalPolicy.DESTROY });


    // 5 - Mapping materials to EEIO emission factors

    // 6 - Publishing matched material NAICS to DF

    // 7 - Included in runtime workflow? Yes

    // 8 - Cleaned invoice data

    // 9 - Cleaned invoice data quality assertions

    // 10 - Scope 3 purchased goods & services

    const checkPipelineExecutions = new Choice(this, 'Executions Finish?')
      .when(Condition.booleanEquals('$.done', true), triggerPipelineTask)
      .when(Condition.booleanEquals('$.done', false), new Wait(this, 'Wait', {
        time: WaitTime.duration(Duration.seconds(20))
      }).next(checkPipelineTask));

    const demoSeederStateMachine = new StateMachine(this, 'SdfDemoSeederStateMachine', {
      definitionBody: DefinitionBody.fromChainable(
        // 2 - Import US EPA Emission Factors into SIF
        triggerPipelineTask
          .next(new Choice(this, 'Executions To Monitor?')
            .when(Condition.numberGreaterThan('$.executionsCount', 0), checkPipelineTask.next(checkPipelineExecutions))
            .when(Condition.numberEquals('$.executionsCount', 0), cloudformationCallbackTask))
      ),
      logs: { destination: sdfDemoSeederLogGroup, level: LogLevel.ERROR, includeExecutionData: true },
      stateMachineName: `sdf-demo-seeder`,
      // It should time out in 15 minutes
      timeout: Duration.minutes(15),
      tracingEnabled: true
    });

    NagSuppressions.addResourceSuppressions([demoSeederStateMachine],
      [
        {
          id: 'AwsSolutions-SF1',
          reason: 'We only care about logging the error for now.'

        }],
      true);

    /**
     * CloudFormation WaitCondition resource to wait until database migration has been performed successfully
     */
    const dataHash = Date.now().toString();
    const cfnWaitConditionHandle = new CfnWaitConditionHandle(this, 'CfnWaitConditionHandle'.concat(dataHash));

    const startExecutionCommand = {
      service: 'sfn',
      action: 'StartExecution',
      parameters: {
        stateMachineArn: demoSeederStateMachine.stateMachineArn,
        input: JSON.stringify({
          callbackUrl: cfnWaitConditionHandle.ref,
          tasks: [
            {
              priority: 1,
              resourcesPrefix: 'products/useeio/resources',
              sifResourcesPrefix: 'products/useeio/sifResources'
            },
            {
              priority: 2,
              resourcesPrefix: 'products/usepa/converted/2023',
              sifResourcesPrefix: 'products/usepa/sifResources'
            },
            {
              priority: 3,
              resourcesPrefix: 'products/usepa/converted/2024',
              sifResourcesPrefix: 'products/usepa/sifResources'
            },
            {
              priority: 4,
              resourcesPrefix: 'demo/materialsNaicsMatching/resources',
              sifResourcesPrefix: 'demo/materialsNaicsMatching/sifResources'
            }]
        })
      } as StartExecutionInput,
      physicalResourceId: cr.PhysicalResourceId.fromResponse('executionArn')
    };

    const runDemoSeederCustomResource = new cr.AwsCustomResource(this, 'RunDemoSeederStateMachine', {
      resourceType: 'Custom::RunDemoSeederStateMachine',
      onCreate: startExecutionCommand,
      onUpdate: startExecutionCommand,
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE
      })
    });

    // Note: AWS::CloudFormation::WaitCondition resource type does not support updates.
    new CfnWaitCondition(this, 'WC'.concat(dataHash), {
      count: 1,
      timeout: '1800',
      handle: cfnWaitConditionHandle.ref
    }).node.addDependency(runDemoSeederCustomResource);


  }
}
