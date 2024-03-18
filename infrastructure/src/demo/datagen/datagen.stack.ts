import { CustomResource, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { IRole, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
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
import { REDSHIFT_DATABASE_NAME, REDSHIFT_WORKGROUP_NAME } from './redshift/constants.js';
import { CopyS3Data, ExistingRedshiftServerlessProps } from './redshift/models.js';
import { RedshiftAssociateIAMRole } from './redshift/redshift-associate-iam-role.js';
import { createLambdaRole } from './redshift/utils/lambda.js';
import { createLogGroup } from './redshift/utils/logs.js';
import { createSGForEgressToAwsService } from './redshift/utils/sg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type DatagenStackProperties = StackProps & {
	userVpcConfig?: SdfVpcConfig;
	bucketName: string;
};

export const redshiftUserParameter = `/df/sdfDemo/redshift/username`;

export class DatagenInfrastructureStack extends Stack {
	readonly vpcId: string;

	constructor(scope: Construct, id: string, props: DatagenStackProperties) {
		super(scope, id, props);

		// bucket to store demo data
		const dataBucket = Bucket.fromBucketName(this, 'DataBucket', props.bucketName);

		// upload demo data to s3. some will be pushed to redshift later
		const demoDataPath = path.join(__dirname, '..', '..', '..', '..', 'typescript', 'packages', 'demo', 'datagen', 'generatedResources');
		new BucketDeployment(this, 'DemoDataDeployment', {
			sources: [Source.asset(demoDataPath)],
			destinationBucket: dataBucket,
			destinationKeyPrefix: 'demo/datagen/',
		});

		const network = new Network(this, 'Network', {
			userVpcConfig: props.userVpcConfig ? props.userVpcConfig : undefined,
		});

		const securityGroupForLambda = createSGForEgressToAwsService(this, 'LambdaEgressToAWSServiceSG', network.vpc);

		const redshiftServerlessWorkgroup = new RedshiftServerless(this, 'RedshiftServerlessWorkgroup', {
			vpc: network.vpc,
			subnetSelection: {
				subnets: network.vpc.isolatedSubnets,
			},
			securityGroupIds: securityGroupForLambda.securityGroupId,
			baseCapacity: 8, // 8 to 512 RPUs
			workgroupName: REDSHIFT_WORKGROUP_NAME,
			databaseName: REDSHIFT_DATABASE_NAME,
			dataBucket: dataBucket.bucketName,
		});

		const existingRedshiftServerlessProps: ExistingRedshiftServerlessProps = {
			createdInStack: true,
			workgroupId: redshiftServerlessWorkgroup.workgroup.attrWorkgroupWorkgroupId,
			workgroupName: redshiftServerlessWorkgroup.workgroup.attrWorkgroupWorkgroupName,
			namespaceId: redshiftServerlessWorkgroup.namespaceId,
			dataAPIRoleArn: redshiftServerlessWorkgroup.redshiftDataAPIExecRole.roleArn,
			databaseName: redshiftServerlessWorkgroup.databaseName,
		};

		// custom resource to associate the IAM role to redshift cluster
		const redshiftRoleForCopyFromS3 = new Role(this, 'CopyDataFromS3Role', {
			assumedBy: new ServicePrincipal('redshift.amazonaws.com'),
		});
		dataBucket.grantRead(redshiftRoleForCopyFromS3);

		const crForModifyClusterIAMRoles = new RedshiftAssociateIAMRole(this, 'RedshiftAssociateS3CopyRole', {
			serverlessRedshift: existingRedshiftServerlessProps,
			role: redshiftRoleForCopyFromS3,
		}).cr;
		crForModifyClusterIAMRoles.node.addDependency(redshiftServerlessWorkgroup);

		// load the data from S3
		const cr = this.createCopyFromS3CustomResource(
			dataBucket.bucketName,
			redshiftServerlessWorkgroup.workgroupDefaultAdminRole,
			redshiftRoleForCopyFromS3,
			redshiftServerlessWorkgroup.workgroup,
			redshiftServerlessWorkgroup.databaseName
		);
		cr.node.addDependency(redshiftServerlessWorkgroup.redshiftUserCR);
		cr.node.addDependency(crForModifyClusterIAMRoles);

		// TODO: Create custom resource to call data asset module to register all of above datasets, as well as setting glossary terms
	}

	private createCopyFromS3CustomResource(dataBucket: string, workgroupDefaultAdminRole: IRole, redshiftRoleForCopyFromS3: IRole, workgroup: CfnWorkgroup, databaseName: string): CustomResource {
		const eventHandler = this.createCopyFromS3Function();
		workgroupDefaultAdminRole.grantAssumeRole(eventHandler.grantPrincipal);

		const provider = new Provider(this, 'CopyFromS3CustomResourceProvider', {
			onEventHandler: eventHandler,
			logRetention: RetentionDays.ONE_WEEK,
		});

		const customProps: CopyS3Data = {
			serverlessRedshiftProps: {
				workgroupName: workgroup.attrWorkgroupWorkgroupName,
				workgroupId: workgroup.attrWorkgroupWorkgroupId,
				dataAPIRoleArn: workgroupDefaultAdminRole.roleArn,
				databaseName,
			},
			dataBucket,
			redshiftRoleForCopyFromS3: redshiftRoleForCopyFromS3.roleArn,
		};
		const cr = new CustomResource(this, 'CopyFromS3CustomResource', {
			serviceToken: provider.serviceToken,
			properties: customProps,
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
				banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);import { fileURLToPath } from 'url';import { dirname } from 'path';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);",
				externalModules: ['aws-sdk'],
			},
			depsLockFilePath: path.join(__dirname, '../../../../common/config/rush/pnpm-lock.yaml'),
			architecture: Architecture.ARM_64,
		});

		return fn;
	}
}
