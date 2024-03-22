import { Construct } from 'constructs';
import { CustomResource } from 'aws-cdk-lib';

export type DatagenProps = {
	bucketName: string;
	customResourceProviderToken: string;
};

export class DatagenInfrastructureConstruct extends Construct {
	readonly vpcId: string;

	constructor(scope: Construct, id: string, props: DatagenProps) {
		super(scope, id);

		new CustomResource(this, 'DatagenProductSeeder', {
			serviceToken: props.customResourceProviderToken,
			resourceType: 'Custom::GeneralProductSeeder',
			properties: {
				uniqueToken: Date.now(),
				prefix: 'demo/datagen',
				bucket: props.bucketName
			}
		});

	};

}
