import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import path from 'path';
import * as cr from 'aws-cdk-lib/custom-resources';
import { fileURLToPath } from 'url';
import { NagSuppressions } from 'cdk-nag';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { REDSHIFT_CONFIGURATION_SECRET } from '../spoke/demo/redshift/constants.js';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CommonHubInfrastructureProperties {
  domainId: string;
  domainName: string;
  projectId: string;
  athenaEnvironmentId: string;
  redshiftEnvironmentId: string;
  spokeAccountId: string;
  spokeBucketArn: string;
  roleArn: string;
  sifAdminEmailAddress: string;
  sifAdminUserId: string;
}

export const crProviderServiceTokenParameter = `/df/sdf/customResourceProviderToken`;
export const dataAssetFunctionNameParameter = `/df/dataAsset/functionName`;

export class CommonHubInfrastructureStack extends Stack {

  public customResourceServiceToken: string;

  public constructor(scope: Construct, id: string, props: StackProps & CommonHubInfrastructureProperties) {
    super(scope, id, props);

    const bucket = Bucket.fromBucketArn(this, 'SpokeBucket', props.spokeBucketArn);

    const redshiftConfigurationSecret = Secret.fromSecretAttributes(this, 'SpokeRedshiftConfigurationSecret', {
      secretPartialArn: `arn:aws:secretsmanager:${Stack.of(this).region}:${props.spokeAccountId}:secret:${REDSHIFT_CONFIGURATION_SECRET}`
    });

    const dataAssetFunctionName = StringParameter.fromStringParameterAttributes(this, 'dataAssetFunctionNameParameter', {
      parameterName: dataAssetFunctionNameParameter,
      simpleName: false
    }).stringValue;

    const dataAssetLambda = NodejsFunction.fromFunctionName(this, 'DataAssetLambda', dataAssetFunctionName);

    const deploymentHelperLambda = new NodejsFunction(this, 'DeploymentHelperLambda', {
      functionName: `sdf-hub-deploymentHelper`,
      description: `SDF Deployment Helper Lambda (Hub)`,
      entry: path.join(__dirname, '../../../typescript/packages/libraries/deployment-helper-hub/src/handler.ts'),
      runtime: Runtime.NODEJS_20_X,
      tracing: Tracing.ACTIVE,
      memorySize: 512,
      logRetention: RetentionDays.ONE_WEEK,
      timeout: Duration.minutes(15),
      environment: {
        DATA_ASSET_FUNCTION_NAME: dataAssetFunctionName,
        DATAZONE_ATHENA_ENVIRONMENT_ID: props.athenaEnvironmentId,
        DATAZONE_REDSHIFT_ENVIRONMENT_ID: props.redshiftEnvironmentId,
        DATAZONE_DOMAIN_ID: props.domainId,
        DATAZONE_DOMAIN_NAME: props.domainName,
        DATAZONE_PROJECT_ID: props.projectId,
        DATAZONE_ROLE_ARN: props.roleArn,
        SPOKE_ACCOUNT_ID: props.spokeAccountId,
        SIF_ADMINISTRATOR_EMAIL: props.sifAdminEmailAddress,
        SIF_ADMINISTRATOR_USER_ID: props.sifAdminUserId
      },
      bundling: {
        minify: true,
        format: OutputFormat.ESM,
        target: 'node18.16',
        sourceMap: false,
        sourcesContent: false,
        banner: 'import { createRequire } from \'module\';const require = createRequire(import.meta.url);import { fileURLToPath } from \'url\';import { dirname } from \'path\';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);',
        externalModules: ['aws-sdk', 'pg-native']
      },
      depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
      architecture: Architecture.ARM_64
    });

    bucket.grantRead(deploymentHelperLambda);
    dataAssetLambda.grantInvoke(deploymentHelperLambda);
    redshiftConfigurationSecret.grantRead(deploymentHelperLambda);
    deploymentHelperLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['kms:Decrypt', 'kms:CreateGrant'],
      resources: ['*']
    }));

    const deploymentHelperResourceProvider = new cr.Provider(this, 'DeploymentHelperResourceProvider', {
      onEventHandler: deploymentHelperLambda
    });

    this.customResourceServiceToken = deploymentHelperResourceProvider.serviceToken;

    new StringParameter(this, 'customResourceProviderToken', {
      parameterName: crProviderServiceTokenParameter,
      stringValue: deploymentHelperResourceProvider.serviceToken
    });

    NagSuppressions.addResourceSuppressionsByPath(this, [
        '/SdfHubCommonStack/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource'
      ],
      [

        {
          id: 'AwsSolutions-IAM4',
          appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
          reason: 'This policy attached to the role is generated by CDK.'

        },
        {
          id: 'AwsSolutions-IAM5',
          appliesTo: ['Resource::*'],
          reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to logs:DeleteRetentionPolicy and logs:PutRetentionPolicy actions.'

        }],
      true);

    NagSuppressions.addResourceSuppressions(deploymentHelperResourceProvider, [

      {
        id: 'AwsSolutions-IAM4',
        reason: 'This only contains the policy the create and insert log to log group.',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'This only applies to the seeder lambda defined in this construct and its versions.',
        appliesTo: ['Resource::<DeploymentHelperLambda1F585C1F.Arn>:*']
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'The cr.Provider library is not maintained by this project.'
      }
    ], true);

    NagSuppressions.addResourceSuppressions([deploymentHelperLambda], [
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [
          'Action::s3:GetBucket*',
          'Action::s3:GetObject*',
          'Action::s3:List*',
          `Resource::${props.spokeBucketArn}/*`,
          `Resource::arn:<AWS::Partition>:lambda:${Stack.of(this).region}:${Stack.of(this).account}:function:<dataAssetFunctionNameParameterParameter>:*`
        ],
        reason: 'the policy is required for the lambda to access the s3 bucket that contains reference datasets file.'
      },
      {
        id: 'AwsSolutions-IAM4',
        reason: 'This only contains the policy the create and insert log to log group.',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
      },
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: ['Resource::*'],
        reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments.'
      }
    ], true);
  }
}
