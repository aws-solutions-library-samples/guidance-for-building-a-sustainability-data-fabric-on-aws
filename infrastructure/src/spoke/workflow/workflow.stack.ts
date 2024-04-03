import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { WorkflowConstruct } from './workflow.construct.js';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export type SpokeWorkflowStackProperties = StackProps & {
	bucketName: string;
	environment: string;
	tenantId: string;
	sifAdminEmailAddress: string;
	dfSustainabilityRoleArn: string;
	domainId: string;
	athenaEnvironmentId: string;
};

export const pipelinesApiFunctionNameParameter = (tenantId: string, environment: string) => `/sif/${tenantId}/${environment}/pipelines/apiFunctionName`;

export const pipelinesProcessorsApiFunctionNameParameter = (tenantId: string, environment: string) => `/sif/${tenantId}/${environment}/pipeline-processor/apiFunctionNameV2`;

export class SpokeWorkflowInfrastructureStack extends Stack {
	constructor(scope: Construct, id: string, props: SpokeWorkflowStackProperties) {
		super(scope, id, props);

		const pipelineApiFunctionName = StringParameter.fromStringParameterAttributes(this, 'pipelineApiFunctionName', {
			parameterName: pipelinesApiFunctionNameParameter(props.tenantId, props.environment),
			simpleName: false
		}).stringValue;

		const pipelineProcessorApiFunctionName = StringParameter.fromStringParameterAttributes(this, 'pipelineProcessorApiFunctionName', {
			parameterName: pipelinesProcessorsApiFunctionNameParameter(props.tenantId, props.environment),
			simpleName: false
		}).stringValue;

		const workflow = new WorkflowConstruct(this, 'Workflow', {
			bucketName: props.bucketName,
			pipelineApiFunctionName,
			pipelineProcessorApiFunctionName,
			sifAdminEmailAddress: props.sifAdminEmailAddress,
			dfSustainabilityRoleArn: props.dfSustainabilityRoleArn,
			domainId: props.domainId,
			athenaEnvironmentId: props.athenaEnvironmentId
		});
	}
}
