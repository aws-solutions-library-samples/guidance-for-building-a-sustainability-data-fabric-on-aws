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


import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { AccountPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import path from 'path';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lf from 'aws-cdk-lib/aws-lakeformation';
import { fileURLToPath } from 'url';
import { NagSuppressions } from 'cdk-nag';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const bucketParameter = `/df/sdf/bucketName`;

export interface CommonInfrastructureProperties {
	hubAccountId: string;
	spokeBucketName: string;
	domainId: string;
	domainName: string;
	projectId: string;
	athenaEnvironmentId: string;
	redshiftEnvironmentId: string;
	roleArn: string;
	tenantId: string;
	environment: string;
	sifAdminEmailAddress: string;
}

export const pipelinesApiFunctionNameParameter = (tenantId: string, environment: string) => `/sif/${tenantId}/${environment}/pipelines/apiFunctionName`;
export const crHubProviderServiceTokenParameter = `/df/sdf/customResourceProviderToken`;

export class CommonInfrastructureStack extends Stack {
	readonly bucketName: string;

	constructor(scope: Construct, id: string, props: StackProps & CommonInfrastructureProperties) {
		super(scope, id, props);

		const accountId = Stack.of(this).account;
		const region = Stack.of(this).region;

		// bucket to store seeded data
		this.bucketName = props.spokeBucketName;
		const bucket = new Bucket(this, 'Bucket', {
			bucketName: this.bucketName,
			encryption: BucketEncryption.S3_MANAGED,
			intelligentTieringConfigurations: [
				{
					name: 'archive',
					archiveAccessTierTime: Duration.days(90),
					deepArchiveAccessTierTime: Duration.days(180)
				}
			],
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: true,
			versioned: false,
			serverAccessLogsPrefix: 'data',
			removalPolicy: RemovalPolicy.DESTROY
		});

		const dataLocation = new lf.CfnResource(this, 'DataBucketResource', {
			resourceArn: bucket.bucketArn,
			useServiceLinkedRole: true
		});

        const dataLocationPerms = new lf.CfnPermissions(this, 'DataBucketServiceRolePerms', {
            dataLakePrincipal: {
                dataLakePrincipalIdentifier: props.roleArn,
              },
              resource: {
                dataLocationResource: {
                    catalogId: accountId,
					s3Resource: bucket.bucketArn
                }
              },
			  permissions: ['DATA_LOCATION_ACCESS']
        });

		dataLocationPerms.addDependency(dataLocation);

		const accountPrincipal = new AccountPrincipal(props.hubAccountId);

		bucket.addToResourcePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				principals: [accountPrincipal],
				actions: ['s3:GetObject', 's3:List*'], // Adjust permissions as needed
				resources: [`${bucket.bucketArn}/*`, `${bucket.bucketArn}`]
			})
		);

		new StringParameter(this, 'bucket', {
			parameterName: bucketParameter,
			stringValue: bucket.bucketName
		});

		const pipelineApiFunctionName = StringParameter.fromStringParameterAttributes(this, 'pipelineApiFunctionName', {
			parameterName: pipelinesApiFunctionNameParameter(props.tenantId, props.environment),
			simpleName: false
		}).stringValue;

		const pipelineLambda = NodejsFunction.fromFunctionName(this, 'PipelineLambda', pipelineApiFunctionName);

		const deploymentHelperLambda = new NodejsFunction(this, 'DeploymentHelperLambda', {
			functionName: `sdf-spoke-deploymentHelper`,
			description: `SDF Deployment Helper Lambda (Spoke)`,
			entry: path.join(__dirname, '../../../typescript/packages/libraries/deployment-helper-spoke/src/handler.ts'),
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(15),
			environment: {
				SPOKE_ACCOUNT_ID: accountId,
				PIPELINE_API_FUNCTION_NAME: pipelineLambda.functionName,
				LOG_LEVEL: 'trace',
				SIF_ADMINISTRATOR_EMAIL: props.sifAdminEmailAddress
			},
			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20.11',
				sourceMap: false,
				sourcesContent: false,
				banner: 'import { createRequire } from \'module\';const require = createRequire(import.meta.url);import { fileURLToPath } from \'url\';import { dirname } from \'path\';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);',
				externalModules: ['aws-sdk', 'pg-native']
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: Architecture.ARM_64
		});

		bucket.grantRead(deploymentHelperLambda);
		pipelineLambda.grantInvoke(deploymentHelperLambda);

		const deploymentHelperResourceProvider = new cr.Provider(this, 'DeploymentHelperResourceProvider', {
			onEventHandler: deploymentHelperLambda
		});

		new StringParameter(this, 'customResourceProviderToken', {
			parameterName: crHubProviderServiceTokenParameter,
			stringValue: deploymentHelperResourceProvider.serviceToken
		});

		NagSuppressions.addResourceSuppressionsByPath(this, [
				'/SdfSpokeCommonStack/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource'
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
					`Resource::<Bucket83908E77.Arn>/*`,
					`Resource::arn:<AWS::Partition>:lambda:${Stack.of(this).region}:${Stack.of(this).account}:function:<pipelineApiFunctionNameParameter>:*`],
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
