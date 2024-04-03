import { CustomResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface UsepaProperties {
	customResourceProviderToken: string;
	bucketName: string;
}

export class UsepaInfrastructureConstruct extends Construct {

	public constructor(scope: Construct, id: string, props: UsepaProperties) {
		super(scope, id);

		new CustomResource(this, 'UsepaProductSeeder', {
			serviceToken: props.customResourceProviderToken,
			resourceType: 'Custom::UsepaProductSeeder',
			properties: {
				uniqueToken: Date.now(),
				prefix: 'products/usepa',
				bucket: props.bucketName
			}
		});

	}

}
