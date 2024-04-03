import { Construct } from 'constructs';
import { CustomResource, Stack } from 'aws-cdk-lib';
import { REDSHIFT_CONFIGURATION_SECRET } from '../../spoke/demo/redshift/constants.js';

export type DatagenProps = {
	bucketName: string;
	customResourceProviderToken: string;
	spokeAccountId: string;
};

export class DatagenInfrastructureConstruct extends Construct {
	readonly vpcId: string;

	constructor(scope: Construct, id: string, props: DatagenProps) {
		super(scope, id);

		// Custom resource to register material and invoice csv table in DataZone
		new CustomResource(this, 'DatagenProductSeeder', {
			serviceToken: props.customResourceProviderToken,
			resourceType: 'Custom::GeneralProductSeeder',
			properties: {
				uniqueToken: Date.now(),
				prefix: 'demo/datagen',
				bucket: props.bucketName
			}
		});

		// Custom resource to register Redshift table in DataZone
		new CustomResource(this, 'DatagenRedshiftProductSeeder', {
			serviceToken: props.customResourceProviderToken,
			resourceType: 'Custom::RedshiftProductSeeder',
			properties: {
				uniqueToken: Date.now(),
				assetName: 'material-table',
				assetInput: 'materials',
				workflowName: 'material-import-workflow',
				secretArn: `arn:aws:secretsmanager:${Stack.of(this).region}:${props.spokeAccountId}:secret:${REDSHIFT_CONFIGURATION_SECRET}`
			}
		});
	};
}
