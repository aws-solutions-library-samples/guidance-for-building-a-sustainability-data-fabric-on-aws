import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Network, SdfVpcConfig } from './network.construct.js';
import { createSGForEgressToAwsService } from './redshift/custom-resources/sg.js';
import { RedshiftServerless } from './redshift/redshift-serverless.construct.js';

export type DatagenStackProperties = StackProps & {
	userVpcConfig?: SdfVpcConfig;
};

export class DatagenInfrastructureStack extends Stack {
	vpcId: string;

	constructor(scope: Construct, id: string, props: DatagenStackProperties) {
		super(scope, id, props);

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
			baseCapacity: 8,		// 8 to 512 RPUs
			workgroupName: 'sdf-demo-wg',
			databaseName: 'dev'
		});

	}
}
