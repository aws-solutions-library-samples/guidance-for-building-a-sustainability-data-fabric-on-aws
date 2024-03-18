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

import { Arn, ArnFormat, CfnCondition, CfnResource, CustomResource, Duration, Stack, Token } from 'aws-cdk-lib';
import path from 'path';

import { IRole, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { AssociateIAMRoleToRedshift, ExistingRedshiftServerlessProps } from './models.js';
import { createLambdaRole } from './utils/lambda.js';
import { fileURLToPath } from 'url';
import { createLogGroup } from './utils/logs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export interface RedshiftAssociateIAMRoleProps {
	readonly serverlessRedshift?: ExistingRedshiftServerlessProps;
	readonly role: IRole;
	/**
	 * default 50 seconds
	 */
	readonly timeoutInSeconds?: number;
}

export class RedshiftAssociateIAMRole extends Construct {
	public readonly cr: CustomResource;

	constructor(scope: Construct, id: string, props: RedshiftAssociateIAMRoleProps) {
		super(scope, id);

		if (!props.serverlessRedshift) {
			throw new Error('Must specify serverless Redshift config.');
		}

		const logGroup = createLogGroup(scope, {prefix: 'sdfDemo-datagen-associateIAMRoleToRedshift'});

		const fn = new NodejsFunction(scope, 'AssociateIAMRoleToRedshiftFn', {
			functionName: `sdfDemo-datagen-associateIAMRoleToRedshift`,
			description: `SDF Demo datagen - Associate IAM role to Redshift`,
			entry: path.join(__dirname, 'custom-resources', 'redshift-associate-iam-role.ts'),
			handler: 'handler',
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 256,
			timeout: Duration.minutes(5),
			logGroup,
			role: createLambdaRole(scope, 'AssociateIAMRoleFnRole', false, [
				new PolicyStatement({
					actions: ['iam:PassRole'],
					resources: ['*'], //NOSONAR have to use wildcard for keeping existing associated roles,
				}),
			]),

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

		const provider = new Provider(scope, 'RedshiftAssociateIAMRoleCustomResourceProvider', {
			onEventHandler: fn,
			logRetention: RetentionDays.FIVE_DAYS,
		});

		const customProps: AssociateIAMRoleToRedshift = {
			roleArn: props.role.roleArn,
			timeoutInSeconds: props.timeoutInSeconds ?? 50,
			serverlessRedshiftProps: props.serverlessRedshift,
		};

		this.cr = new CustomResource(scope, 'RedshiftAssociateIAMRoleCustomResource', {
			serviceToken: provider.serviceToken,
			properties: customProps,
		});

		this.createServerlessPolicy(props.serverlessRedshift, fn);
	}

	private createServerlessPolicy(serverlessRedshift: ExistingRedshiftServerlessProps, fn: NodejsFunction) {
		if (serverlessRedshift.workgroupId && Token.isUnresolved(serverlessRedshift.workgroupId) && !serverlessRedshift.createdInStack) {
			// we can not make the CR depends on two conditional resources, have to use wildcard for this uncertain dependencies
			this.cr.node.addDependency(this.createRedshiftServerlessWorkgroupPolicy('RedshiftServerlessAllWorkgroupPolicy', '*', fn.role!));
		} else {
			this.cr.node.addDependency(this.createRedshiftServerlessWorkgroupPolicy('RedshiftServerlessWorkgroupPolicy', serverlessRedshift.workgroupId ?? '*', fn.role!));
		}
		if (serverlessRedshift.namespaceId && Token.isUnresolved(serverlessRedshift.namespaceId) && !serverlessRedshift.createdInStack) {
			// we can not make the CR depends on two conditional resources, have to use wildcard for this uncertain dependencies
			this.cr.node.addDependency(this.createRedshiftServerlessNamespacePolicy('RedshiftServerlessAllNamespacePolicy', '*', fn.role!));
		} else {
			this.cr.node.addDependency(this.createRedshiftServerlessNamespacePolicy('RedshiftServerlessNamespacePolicy', serverlessRedshift.namespaceId ?? '*', fn.role!));
		}
	}

	private createRedshiftServerlessWorkgroupPolicy(id: string, workgroupId: string, role: IRole, condition?: CfnCondition): Policy {
		const policy = new Policy(this, id, {
			roles: [role],
			statements: [
				new PolicyStatement({
					actions: ['redshift-serverless:GetWorkgroup'],
					resources: [
						Arn.format(
							{
								service: 'redshift-serverless',
								resource: 'workgroup',
								resourceName: workgroupId,
								arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
							},
							Stack.of(this)
						),
					],
				}),
			],
		});
		if (condition) {
			(policy.node.findChild('Resource') as CfnResource).cfnOptions.condition = condition;
		}
		return policy;
	}

	private createRedshiftServerlessNamespacePolicy(id: string, namespaceId: string, role: IRole, condition?: CfnCondition): Policy {
		const policy = new Policy(this, id, {
			roles: [role],
			statements: [
				new PolicyStatement({
					actions: ['redshift-serverless:GetNamespace', 'redshift-serverless:UpdateNamespace'],
					resources: [
						Arn.format(
							{
								service: 'redshift-serverless',
								resource: 'namespace',
								resourceName: namespaceId,
								arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
							},
							Stack.of(this)
						),
					],
				}),
			],
		});
		if (condition) {
			(policy.node.findChild('Resource') as CfnResource).cfnOptions.condition = condition;
		}
		return policy;
	}
}
