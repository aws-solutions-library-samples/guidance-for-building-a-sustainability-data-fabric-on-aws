import { Arn, ArnFormat, Aws, CustomResource, Duration, Fn, Stack } from 'aws-cdk-lib';
import { AccountPrincipal, IRole, PolicyDocument, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Architecture, IFunction, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnWorkgroup } from 'aws-cdk-lib/aws-redshiftserverless';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import path from 'path';
import { addCfnNagForCustomResourceProvider, addCfnNagToStack, ruleRolePolicyWithWildcardResources, ruleToSuppressRolePolicyWithWildcardResources } from './cfn-nag.js';
import { createLambdaRole } from './custom-resources/lambda.js';
import { attachListTagsPolicyForFunction } from './custom-resources/tags.js';
import { CreateMappingRoleUser, NewNamespaceCustomProperties, RedshiftServerlessWorkgroupProps } from './models.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RedshiftServerless extends Construct {
	readonly namespaceName: string;
	readonly namespaceId: string;
	readonly databaseName: string;
	readonly workgroupDefaultAdminRole: IRole;
	readonly redshiftDataAPIExecRole: IRole;
	readonly redshiftUserCR: CustomResource;
	readonly workgroup: CfnWorkgroup;
	readonly workgroupPort = '5439';

	readonly thisScope: Construct;

	constructor(scope: Construct, id: string, props: RedshiftServerlessWorkgroupProps) {
		super(scope, id);

		this.thisScope = scope;

		this.workgroupDefaultAdminRole = new Role(this, 'SdfDemoRedshiftServerlessWorkgroupAdminRole', {
			assumedBy: new AccountPrincipal(Aws.ACCOUNT_ID),
			inlinePolicies: {
				'redshift-serverless-create-namespace': new PolicyDocument({
					statements: [
						new PolicyStatement({
							actions: ['redshift-serverless:CreateNamespace', 'redshift-serverless:DeleteNamespace', 'redshift-serverless:GetNamespace'],
							resources: ['*'],
						}),
						new PolicyStatement({
							actions: ['redshift-serverless:TagResource', 'redshift-serverless:UntagResource'],
							resources: [
								Arn.format(
									{
										service: 'redshift-serverless',
										resource: 'namespace',
										resourceName: '*',
										arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
									},
									Stack.of(this)
								),
							],
						}),
					],
				}),
				'redshift-service-role': new PolicyDocument({
					statements: [
						new PolicyStatement({
							actions: ['iam:CreateServiceLinkedRole'],
							resources: [
								// arn:aws:iam::<AWS-account-ID>:role/aws-service-role/redshift.amazonaws.com/AWSServiceRoleForRedshift
								// https://docs.aws.amazon.com/redshift/latest/mgmt/using-service-linked-roles.html
								Arn.format(
									{
										resource: 'role',
										region: '', // region be empty for IAM resources
										resourceName: 'aws-service-role/redshift.amazonaws.com/AWSServiceRoleForRedshift',
										service: 'iam',
										arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
									},
									Stack.of(this)
								),
							],
							conditions: {
								StringLike: { 'iam:AWSServiceName': 'redshift.amazonaws.com' },
							},
						}),
					],
				}),
			},
			description: `Managed by ${Stack.of(this).templateOptions.description} to manage the lifecycle of Redshift namespace.`,
		});
		this.grantDataAPIExecutePolicy(this.workgroupDefaultAdminRole as Role);

		this.redshiftDataAPIExecRole = new Role(this, 'RedshiftServerlessDataAPIRole', {
			assumedBy: new AccountPrincipal(Aws.ACCOUNT_ID),
			description: `Managed by ${Stack.of(this).templateOptions.description} to load data into Redshift workgroup.`,
		});
		this.grantDataAPIExecutePolicy(this.redshiftDataAPIExecRole as Role);

		const namespaceCR = this.createRedshiftNamespaceCustomResource(props);
		this.namespaceName = namespaceCR.getAttString('NamespaceName');
		this.namespaceId = namespaceCR.getAttString('NamespaceId');
		this.databaseName = namespaceCR.getAttString('DatabaseName');

		this.workgroup = new CfnWorkgroup(this, 'SdfDemoWorkgroup', {
			workgroupName: props.workgroupName,
			baseCapacity: props.baseCapacity,
			enhancedVpcRouting: false,
			namespaceName: this.namespaceName,
			publiclyAccessible: false,
			port: Number(this.workgroupPort),
			securityGroupIds: Fn.split(',', props.securityGroupIds),
			subnetIds: props.vpc.selectSubnets(props.subnetSelection).subnetIds,
		});
		this.redshiftUserCR = this.createRedshiftMappingUserCustomResource();

		this.addCfnNagSuppression();
	}

	private addCfnNagSuppression() {
		const stack = Stack.of(this);
		addCfnNagForCustomResourceProvider(stack, 'CDK built-in provider for CreateRedshiftServerlessNamespaceCustomResourceProvider', 'CreateRedshiftServerlessNamespaceCustomResourceProvider');
		addCfnNagForCustomResourceProvider(stack, 'CDK built-in custom resource provider for CreateRedshiftServerlessMappingUserCustomResource', 'CreateRedshiftServerlessMappingUserCustomResourceProvider');
		addCfnNagForCustomResourceProvider(stack, 'Metrics', 'MetricsCustomResourceProvider', '');

		addCfnNagToStack(stack, [
			ruleRolePolicyWithWildcardResources('DataAPIRole/DefaultPolicy/Resource', 'Redshift serverless data API role', 'redshift-data'),
			ruleRolePolicyWithWildcardResources('WorkgroupAdminRole/DefaultPolicy/Resource', 'RedshiftServerlessNamespaceAdmin', 'redshift-data'),
			{
				paths_endswith: ['WorkgroupAdminRole/DefaultPolicy/Resource', 'SdfDemoRedshiftServerlessWorkgroupAdminRole/Resource'],
				rules_to_suppress: [
					{
						id: 'W11',
						reason: 'Have to using wildcard resources for creating undetermined Redshift Serverless namespace.',
					},
				],
			},
			{
				paths_endswith: ['WorkgroupAdminRole/DefaultPolicy/Resource'],
				rules_to_suppress: [ruleToSuppressRolePolicyWithWildcardResources('Create workgroup Lambda', 'redshift-serverless workgroup')],
			},
			{
				paths_endswith: ['CreateUserFn/Resource', 'CreateNamespaceFn/Resource'],
				rules_to_suppress: [
					{
						id: 'W89',
						reason: 'Custom resource function without VPC is by design.',
					},
				],
			},
		]);
	}

	private createRedshiftMappingUserCustomResource(): CustomResource {
		const eventHandler = this.createCreateMappingUserFunction();
		this.workgroupDefaultAdminRole.grantAssumeRole(eventHandler.grantPrincipal);

		const provider = new Provider(this, 'CreateRedshiftServerlessMappingUserCustomResourceProvider', {
			onEventHandler: eventHandler,
			logRetention: RetentionDays.ONE_WEEK,
		});

		const customProps: CreateMappingRoleUser = {
			dataRoleName: this.redshiftDataAPIExecRole.roleName,
			serverlessRedshiftProps: {
				workgroupName: this.workgroup.attrWorkgroupWorkgroupName,
				workgroupId: this.workgroup.attrWorkgroupWorkgroupId,
				dataAPIRoleArn: this.workgroupDefaultAdminRole.roleArn,
				databaseName: this.databaseName,
			},
		};
		const cr = new CustomResource(this, 'CreateRedshiftServerlessMappingUserCustomResource', {
			serviceToken: provider.serviceToken,
			properties: customProps,
		});

		return cr;
	}
	createCreateMappingUserFunction() {
		const fn = new NodejsFunction(this.thisScope, 'CreateUserFn', {
			functionName: `sdfDemo-datagen-createRedshiftUser`,
			description: `SDF Demo datagen`,
			entry: path.join(__dirname, 'custom-resources/create-redshift-user.ts'),
			handler: 'handler',
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 128,
			reservedConcurrentExecutions: 1,
			timeout: Duration.minutes(3),
			logRetention: RetentionDays.ONE_WEEK,
			// environment: {
			// },
			role: createLambdaRole(this, 'CreateRedshiftUserRole', false, []),

			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20.11',
				sourceMap: false,
				sourcesContent: false,
				banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);import { fileURLToPath } from 'url';import { dirname } from 'path';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);",
				externalModules: ['aws-sdk'],
			},
			depsLockFilePath: path.join(__dirname, '../../../../../common/config/rush/pnpm-lock.yaml'),
			architecture: Architecture.ARM_64,
		});

		return fn;
	}

	private createRedshiftNamespaceCustomResource(props: RedshiftServerlessWorkgroupProps): CustomResource {
		const eventHandler = this.createCreateNamespaceFunction();
		const policy = attachListTagsPolicyForFunction(this, 'CreateNamespaceFunc', eventHandler);
		this.workgroupDefaultAdminRole.grantAssumeRole(eventHandler.grantPrincipal);

		const provider = new Provider(this, 'CreateRedshiftServerlessNamespaceCustomResourceProvider', {
			onEventHandler: eventHandler,
			logRetention: RetentionDays.ONE_WEEK,
		});

		const customProps: NewNamespaceCustomProperties = {
			adminRoleArn: this.workgroupDefaultAdminRole.roleArn,
			namespaceName: props.workgroupName,
			databaseName: props.databaseName,
		};
		const cr = new CustomResource(this, 'CreateRedshiftServerlessNamespaceCustomResource', {
			serviceToken: provider.serviceToken,
			properties: customProps,
		});

		cr.node.addDependency(policy);

		return cr;
	}

	private createCreateNamespaceFunction(): IFunction {
		const fn = new NodejsFunction(this.thisScope, 'CreateNamespaceFn', {
			functionName: `sdfDemo-datagen-createRedshiftNamespace`,
			description: `SDF Demo datagen`,
			entry: path.join(__dirname, 'custom-resources/create-redshift-namespace.ts'),
			handler: 'handler',
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 128,
			reservedConcurrentExecutions: 1,
			timeout: Duration.minutes(3),
			logRetention: RetentionDays.ONE_WEEK,
			// environment: {
			// },
			role: createLambdaRole(this, 'CreateRedshiftNamespaceRole', false, []),

			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20.11',
				sourceMap: false,
				sourcesContent: false,
				banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);import { fileURLToPath } from 'url';import { dirname } from 'path';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);",
				externalModules: ['aws-sdk'],
			},
			depsLockFilePath: path.join(__dirname, '../../../../../common/config/rush/pnpm-lock.yaml'),
			architecture: Architecture.ARM_64,
		});

		return fn;
	}

	private grantDataAPIExecutePolicy(role: Role) {
		role.addToPolicy(
			new PolicyStatement({
				actions: ['redshift-data:ExecuteStatement', 'redshift-data:BatchExecuteStatement'],
				resources: [
					Arn.format(
						{
							service: 'redshift-serverless',
							resource: 'workgroup',
							resourceName: '*',
							arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
						},
						Stack.of(this)
					),
				],
			})
		);
		role.addToPolicy(
			new PolicyStatement({
				actions: ['redshift-data:DescribeStatement', 'redshift-data:GetStatementResult'],
				resources: ['*'],
			})
		);
		role.addToPolicy(
			new PolicyStatement({
				actions: ['redshift-serverless:GetCredentials'],
				resources: [
					Arn.format(
						{
							service: 'redshift-serverless',
							resource: 'workgroup',
							resourceName: '*',
							arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
						},
						Stack.of(this)
					),
				],
			})
		);
	}
}
