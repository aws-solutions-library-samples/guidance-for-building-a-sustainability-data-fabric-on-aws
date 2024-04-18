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

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface SdfVpcConfig {
	vpcId: string;
	isolatedSubnetIds: string[];
}

export interface NetworkConstructProperties {
	userVpcConfig?: SdfVpcConfig;
}

export const vpcIdParameter = `/df/sdfDemo/network/vpcId`;
export const isolatedSubnetIdsParameter = `/df/sdfDemo/network/isolatedSubnets`;
export const isolatedSubnetIdListParameter = `/df/sdfDemo/network/isolatedSubnetList`;


export class Network extends Construct {
	public vpc: ec2.Vpc;
	public dfVpcConfig: SdfVpcConfig;

	constructor(scope: Construct, id: string, props: NetworkConstructProperties) {
		super(scope, id);

		const accountId = cdk.Stack.of(this).account;
		const region = cdk.Stack.of(this).region;

		if (props.userVpcConfig === undefined) {
			const vpc = new ec2.Vpc(this, 'SdfDemoVpc', {
				vpcName: `sdf-${accountId}-${region}-vpc`,
				subnetConfiguration: [
					{
						name: 'isolated-subnet',
						subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
						cidrMask: 24
					}
				]
			});

			// These 2 endpoints are needed for Glue DataBrew to perform profiling
			vpc.addGatewayEndpoint('s3Endpoint', {
				service: ec2.GatewayVpcEndpointAwsService.S3,
				subnets: [
					{
						subnetGroupName: 'isolated-subnet'
					}]
			});

			vpc.addInterfaceEndpoint('glueEndpoint', {
				service: ec2.InterfaceVpcEndpointAwsService.GLUE,
				subnets: {
					subnetGroupName: 'isolated-subnet'
				}
			});

			this.vpc = vpc;

			new ssm.StringParameter(this, 'vpcIdParameter', {
				parameterName: vpcIdParameter,
				stringValue: this.vpc.vpcId
			});

			new ssm.StringParameter(this, 'isolatedSubnetIdsParameter', {
				parameterName: isolatedSubnetIdsParameter,
				description: 'Isolated subnet IDs used for SDF Demo.',
				stringValue: this.vpc
					.selectSubnets({ subnetGroupName: 'isolated-subnet' })
					.subnets.map((o) => o.subnetId)
					.join(',')
			});

			new ssm.StringListParameter(this, 'isolatedSubnetIdListParameter', {
				parameterName: isolatedSubnetIdListParameter,
				description: 'Isolated subnet IDs used for SDF Demo.',
				stringListValue: this.vpc
					.selectSubnets({ subnetGroupName: 'isolated-subnet' })
					.subnets.map((o) => o.subnetId)
			});

			// Add flow logs.
			const flowLogBucket = new s3.Bucket(this, 'FlowLogBucket', {
				bucketName: `sdfdemo-${accountId}-${region}-fl`,
				encryption: s3.BucketEncryption.S3_MANAGED,
				intelligentTieringConfigurations: [
					{
						name: 'archive',
						archiveAccessTierTime: cdk.Duration.days(90),
						deepArchiveAccessTierTime: cdk.Duration.days(180)
					}
				],
				blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
				enforceSSL: true,
				autoDeleteObjects: true,
				versioned: false,
				serverAccessLogsPrefix: 'access-logs',
				removalPolicy: cdk.RemovalPolicy.DESTROY
			});

			const flowLogName = `sdfDemo-flowlogs`;
			const vpcFlowLogRole = new iam.Role(this, 'vpcFlowLogRole', {
				assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com')
			});
			flowLogBucket.grantWrite(vpcFlowLogRole, `${flowLogName}/*`);

			NagSuppressions.addResourceSuppressions(
				vpcFlowLogRole,
				[
					{
						id: 'AwsSolutions-IAM5',
						reason: 'The role an only modify to a specific flowlog.',
						appliesTo: [
							'Action::s3:Abort*',
							'Action::s3:DeleteObject*',
							`Resource::<NetworkFlowLogBucket879F01A6.Arn>/sdfDemo-flowlogs/*`
						]
					}
				],
				true
			);


			// Create flow logs to S3.
			new ec2.FlowLog(this, 'sharedVpcLowLogs', {
				destination: ec2.FlowLogDestination.toS3(
					flowLogBucket,
					`${flowLogName}/`
				),
				trafficType: ec2.FlowLogTrafficType.ALL,
				flowLogName: flowLogName,
				resourceType: ec2.FlowLogResourceType.fromVpc(vpc)
			});

			this.dfVpcConfig = {
				vpcId: this.vpc.vpcId,
				isolatedSubnetIds: this.vpc
					.selectSubnets({ subnetGroupName: 'isolated-subnet' })
					.subnets.map((o) => o.subnetId)
			};

		} else {
			// user provided a VPC, use that
			this.vpc = ec2.Vpc.fromLookup(this, 'vpc', {
				vpcId: props.userVpcConfig?.vpcId
			}) as ec2.Vpc;

			new ssm.StringParameter(this, 'vpcIdParameter', {
				parameterName: vpcIdParameter,
				stringValue: this.vpc.vpcId
			});

			this.dfVpcConfig = {
				vpcId: this.vpc.vpcId,
				isolatedSubnetIds: props.userVpcConfig.isolatedSubnetIds
			};
		}
	}
}
