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

		// Custom resource to register the transformed invoice in DataZone
		new CustomResource(this, 'CleanInvoiceProduct', {
			serviceToken: props.customResourceProviderToken,
			resourceType: 'Custom::RecipeProductSeeder',
			properties: {
				uniqueToken: Date.now(),
				key: 'demo/datagen/purchased_goods_and_services/data.csv',
				bucket: props.bucketName,
				originalAssetName: 'purchased_goods_and_services',
				ruleset: `Rules = [ ColumnValues "currencycode" in [ "USD" ], IsComplete "materialcode"]`,
				recipe: {
					steps: [
						{
							'Action': {
								'Operation': 'DELETE_DUPLICATE_ROWS',
								'Parameters': {
									'duplicateRowsCount': '14'
								}
							}
						},
						{
							'Action': {
								'Operation': 'REMOVE_VALUES',
								'Parameters': {
									'sourceColumn': 'currencyCode'
								}
							},
							'ConditionExpressions': [
								{
									'Condition': 'IS_NOT',
									'Value': '["USD","string"]',
									'TargetColumn': 'currencyCode'
								}
							]
						}
					]
				}
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
