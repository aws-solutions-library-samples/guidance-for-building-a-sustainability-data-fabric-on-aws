import { Construct } from 'constructs';
import { CustomResource } from 'aws-cdk-lib';
import { UsepaProperties } from './usepa.construct.js';

export class UseeioInfrastructureConstruct extends Construct {

	public constructor(scope: Construct, id: string, props: UsepaProperties) {
		super(scope, id);

		new CustomResource(this, 'UseeioProductSeeder', {
			serviceToken: props.customResourceProviderToken,
			resourceType: 'Custom::GeneralProductSeeder',
			properties: {
				uniqueToken: Date.now(),
				prefix: 'products/useeio/resources',
				bucket: props.bucketName
			}
		});
	}

}
