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

import { CustomResource, Duration, SecretValue, Stack } from 'aws-cdk-lib';
import { AccountPrincipal, IRole, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnWorkgroup } from 'aws-cdk-lib/aws-redshiftserverless';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Network, SdfVpcConfig } from './network.construct.js';
import { RedshiftServerless } from './redshift-serverless.construct.js';
import { REDSHIFT_CONFIGURATION_SECRET, REDSHIFT_CREDENTIAL_SECRET, REDSHIFT_DATABASE_NAME, REDSHIFT_WORKGROUP_NAME } from './redshift/constants.js';
import { CopyS3Data, ExistingRedshiftServerlessProps } from './redshift/models.js';
import { RedshiftAssociateIAMRole } from './redshift/redshift-associate-iam-role.js';
import { createLambdaRole } from './redshift/utils/lambda.js';
import { createLogGroup } from './redshift/utils/logs.js';
import { createSGForEgressToAwsService } from './redshift/utils/sg.js';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Port } from 'aws-cdk-lib/aws-ec2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type DatagenProps = {
	userVpcConfig?: SdfVpcConfig;
	bucketName: string;
	hubAccountId: string;
};

export const redshiftUserParameter = `/df/sdfDemo/redshift/username`;

export class DatagenInfrastructureConstruct extends Construct {
	readonly vpcId: string;

	constructor(scope: Construct, id: string, props: DatagenProps) {
		super(scope, id);

		// Provided bucket to store demo artifacts
		const dataBucket = Bucket.fromBucketName(this, 'DataBucket', props.bucketName);

		// Upload demo data to s3. some will be pushed to redshift later
		const demoDataPath = path.join(__dirname, '..', '..', '..', '..', 'typescript', 'packages', 'demo', 'datagen', 'generatedResources');
		new BucketDeployment(this, 'DemoDataDeployment', {
			sources: [Source.asset(demoDataPath)],
			destinationBucket: dataBucket,
			destinationKeyPrefix: 'demo/datagen/'
		});

		// Amazon Redshift Serverless runs in a VPC
		const network = new Network(this, 'Network', {
			userVpcConfig: props.userVpcConfig ? props.userVpcConfig : undefined
		});

		const securityGroupForLambda = createSGForEgressToAwsService(this, 'LambdaEgressToAWSServiceSG', network.vpc);
		// https://docs.aws.amazon.com/glue/latest/dg/setup-vpc-for-glue-access.html
		securityGroupForLambda.addIngressRule(
			securityGroupForLambda,
			Port.allTraffic(),
			'Allow all internal traffic'
		);

		const redshiftServerlessWorkgroup = new RedshiftServerless(this, 'RedshiftServerlessWorkgroup', {
			vpc: network.vpc,
			subnetSelection: {
				subnets: network.vpc.isolatedSubnets
			},
			securityGroupIds: securityGroupForLambda.securityGroupId,
			baseCapacity: 8, // 8 to 512 RPUs
			workgroupName: REDSHIFT_WORKGROUP_NAME,
			databaseName: REDSHIFT_DATABASE_NAME,
			dataBucket: dataBucket.bucketName
		});

		const existingRedshiftServerlessProps: ExistingRedshiftServerlessProps = {
			workgroupId: redshiftServerlessWorkgroup.workgroup.attrWorkgroupWorkgroupId,
			workgroupName: redshiftServerlessWorkgroup.workgroup.attrWorkgroupWorkgroupName,
			namespaceId: redshiftServerlessWorkgroup.namespaceId,
			dataAPIRoleArn: redshiftServerlessWorkgroup.redshiftDataAPIExecRole.roleArn,
			databaseName: redshiftServerlessWorkgroup.databaseName
		};

		// Redshift requires a role with sufficient permissions to copy from S3
		const redshiftRoleForCopyFromS3 = new Role(this, 'CopyDataFromS3Role', {
			assumedBy: new ServicePrincipal('redshift.amazonaws.com')
		});
		dataBucket.grantRead(redshiftRoleForCopyFromS3);

		// Custom resource to associate the IAM role required to copy from S3 to Redshift cluster
		const crForModifyClusterIAMRoles = new RedshiftAssociateIAMRole(this, 'RedshiftAssociateS3CopyRole', {
			serverlessRedshift: existingRedshiftServerlessProps,
			role: redshiftRoleForCopyFromS3
		}).cr;
		crForModifyClusterIAMRoles.node.addDependency(redshiftServerlessWorkgroup);

		// Customer resource to load the data into redshift from S3
		const crCopyFromS3 = this.createCopyFromS3CustomResource(
			dataBucket.bucketName,
			redshiftServerlessWorkgroup.workgroupDefaultAdminRole,
			redshiftRoleForCopyFromS3,
			redshiftServerlessWorkgroup.workgroup,
			redshiftServerlessWorkgroup.databaseName
		);
		crCopyFromS3.node.addDependency(redshiftServerlessWorkgroup.redshiftUserCR);
		crCopyFromS3.node.addDependency(crForModifyClusterIAMRoles);

		const redshiftConfigurationEncryptionKey = new Key(this, 'RedshiftConfigurationEncryptionKey', {
			enableKeyRotation: true
		});

		const region = Stack.of(this).region;
		const accountId = Stack.of(this).account;

		// This contains the redshift configuration detail needed when registering the datasource in DataZone
		const redshiftConfigurationSecret = new Secret(this, 'RedshiftConfiguration', {
			secretName: REDSHIFT_CONFIGURATION_SECRET,
			secretObjectValue: {
				jdbcConnectionUrl: SecretValue.unsafePlainText(`jdbc:redshift://${REDSHIFT_WORKGROUP_NAME}.${accountId}.${region}.redshift-serverless.amazonaws.com:5439/${REDSHIFT_DATABASE_NAME}`),
				subnetId: SecretValue.unsafePlainText(network.vpc.isolatedSubnets[0].subnetId),
				securityGroupId: SecretValue.unsafePlainText(securityGroupForLambda.securityGroupId),
				workgroupName: SecretValue.unsafePlainText(REDSHIFT_WORKGROUP_NAME),
				redshiftSecretArn: SecretValue.unsafePlainText(`arn:aws:secretsmanager:${region}:${accountId}:secret:${REDSHIFT_CREDENTIAL_SECRET}`),
				availabilityZone: SecretValue.unsafePlainText(network.vpc.isolatedSubnets[0].availabilityZone),
				// The schema and table are set by create-redshift-schema.ts
				path: SecretValue.unsafePlainText(`${redshiftServerlessWorkgroup.databaseName}/sustainability/golden_materials`),
				databaseTableName: SecretValue.unsafePlainText(`sustainability.golden_materials`)
			},
			encryptionKey: redshiftConfigurationEncryptionKey
		});
		redshiftConfigurationEncryptionKey.grantDecrypt(new AccountPrincipal(props.hubAccountId));
		redshiftConfigurationSecret.grantRead(new AccountPrincipal(props.hubAccountId));
		redshiftConfigurationSecret.node.addDependency(redshiftServerlessWorkgroup);
	}

	private createCopyFromS3CustomResource(dataBucket: string, workgroupDefaultAdminRole: IRole, redshiftRoleForCopyFromS3: IRole, workgroup: CfnWorkgroup, databaseName: string): CustomResource {
		const eventHandler = this.createCopyFromS3Function();
		workgroupDefaultAdminRole.grantAssumeRole(eventHandler.grantPrincipal);

		const provider = new Provider(this, 'CopyFromS3CustomResourceProvider', {
			onEventHandler: eventHandler,
			logRetention: RetentionDays.ONE_WEEK
		});

		const customProps: CopyS3Data = {
			serverlessRedshiftProps: {
				workgroupName: workgroup.attrWorkgroupWorkgroupName,
				workgroupId: workgroup.attrWorkgroupWorkgroupId,
				dataAPIRoleArn: workgroupDefaultAdminRole.roleArn,
				databaseName
			},
			dataBucket,
			redshiftRoleForCopyFromS3: redshiftRoleForCopyFromS3.roleArn
		};
		const cr = new CustomResource(this, 'CopyFromS3CustomResource', {
			serviceToken: provider.serviceToken,
			properties: customProps
		});

		return cr;
	}

	private createCopyFromS3Function() {
		const logGroup = createLogGroup(this, { prefix: 'sdfDemo-datagen-copyS3Data' });
		const fn = new NodejsFunction(this, 'CopyS3DataFn', {
			functionName: `sdfDemo-datagen-copyS3Data`,
			description: `SDF Demo datagen`,
			entry: path.join(__dirname, 'redshift', 'custom-resources', 'copy-s3-data.ts'),
			handler: 'handler',
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 128,
			timeout: Duration.minutes(3),
			logGroup,
			role: createLambdaRole(this, 'CopyS3DataRole', false, []),

			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20.11',
				sourceMap: false,
				sourcesContent: false,
				banner: 'import { createRequire } from \'module\';const require = createRequire(import.meta.url);import { fileURLToPath } from \'url\';import { dirname } from \'path\';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);',
				externalModules: ['aws-sdk']
			},
			depsLockFilePath: path.join(__dirname, '../../../../common/config/rush/pnpm-lock.yaml'),
			architecture: Architecture.ARM_64
		});

		return fn;
	}
}
