import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { UsepaInfrastructureConstruct } from './usepa.construct.js';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { crProviderServiceTokenParameter } from '../common.stack.js';
import { UseeioInfrastructureConstruct } from './useeio.construct.js';

export interface HubProductInfrastructureProps {
	bucketName: string;
}

export class HubProductInfrastructureStack extends Stack {

	public constructor(scope: Construct, id: string, props: StackProps & HubProductInfrastructureProps) {
		super(scope, id, props);


		const customResourceProviderToken = StringParameter.fromStringParameterAttributes(this, 'customResourceProviderToken', {
			parameterName: crProviderServiceTokenParameter,
			simpleName: false
		}).stringValue;

		// new UsepaInfrastructureConstruct(this, 'UsepaInfrastructure', {
		// 	customResourceProviderToken,
		// 	bucketName: props.bucketName
		// });

		new UseeioInfrastructureConstruct(this, 'UseeioInfrastructure', {
			customResourceProviderToken,
			bucketName: props.bucketName
		});

	}
}
