import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { DatagenInfrastructureConstruct } from './datagen.construct.js';
import { crProviderServiceTokenParameter } from '../common.stack.js';

export type DemoStackProperties = StackProps & {
	bucketName: string;
};

export class HubDemoInfrastructureStack extends Stack {
	constructor(scope: Construct, id: string, props: DemoStackProperties) {
		super(scope, id, props);

		const customResourceProviderToken = StringParameter.fromStringParameterAttributes(this, 'customResourceProviderToken', {
			parameterName: crProviderServiceTokenParameter,
			simpleName: false
		}).stringValue;


		const datagen = new DatagenInfrastructureConstruct(this, 'Datagen', {
			bucketName: props.bucketName,
			customResourceProviderToken
		});

	}
}
