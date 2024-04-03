import pkg from 'aws-xray-sdk';
import { SFNClient } from '@aws-sdk/client-sfn';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { Cradle, diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, asValue, Lifetime } from 'awilix';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MetadataBearer, RequestPresigningArguments } from '@aws-sdk/types';
import type { Client, Command } from '@aws-sdk/smithy-client';
import { SSMClient } from '@aws-sdk/client-ssm';
import { TriggerPipelineService } from '../services/triggerPipeline.service';
import { ExecutionClient, Invoker, LambdaRequestContext, PipelineClient } from '@df-sustainability/clients';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { CheckPipelineService } from '../services/checkPipeline.service';
import { DataZoneClient } from '@aws-sdk/client-datazone';

const { captureAWSv3Client } = pkg;

export type GetSignedUrl = <InputTypesUnion extends object, InputType extends InputTypesUnion, OutputType extends MetadataBearer = MetadataBearer>(
	client: Client<any, InputTypesUnion, MetadataBearer, any>,
	command: Command<InputType, OutputType, any, InputTypesUnion, MetadataBearer>,
	options?: RequestPresigningArguments
) => Promise<string>;

declare module '@fastify/awilix' {
	interface Cradle {
		stepFunctionClient: SFNClient;
		stsClient: STSClient;
		secretsManagerClient: SecretsManagerClient;
		s3Client: S3Client;
		ssmClient: SSMClient;
		lambdaClient: LambdaClient;
		getSignedUrl: GetSignedUrl;
		triggerPipelineService: TriggerPipelineService;
		checkPipelineService: CheckPipelineService;
		invoker: Invoker;
		pipelineClient: PipelineClient;
		executionClient: ExecutionClient;
		dataZoneClientFactory: DataZoneClientFactory;
	}
}

class StepFunctionClientFactory {
	public static create(region: string | undefined): SFNClient {
		const sfn = captureAWSv3Client(new SFNClient({ region }));
		return sfn;
	}
}

class STSClientFactory {
	public static create(region: string | undefined): STSClient {
		const stsClient = captureAWSv3Client(new STSClient({ region }));
		return stsClient;
	}
}

export class DataZoneClientFactory {
	constructor(private readonly region: string, private readonly stsClient: STSClient, private readonly dfSustainabilityRoleArn: string) {
	}

	public async create(): Promise<DataZoneClient> {
		const data = await this.stsClient.send(new AssumeRoleCommand({ RoleArn: this.dfSustainabilityRoleArn, RoleSessionName: `sdf-spoke-search-listings` }));
		const credentials = {
			accessKeyId: data?.Credentials?.AccessKeyId!,
			secretAccessKey: data?.Credentials?.SecretAccessKey!,
			sessionToken: data?.Credentials?.SessionToken!
		};
		return captureAWSv3Client(new DataZoneClient({ region: this.region, credentials }));
	}
}

class SecretsManagerClientFactory {
	public static create(region: string | undefined): SecretsManagerClient {
		const dz = captureAWSv3Client(new SecretsManagerClient({ region }));
		return dz;
	}
}

class S3ClientFactory {
	public static create(region: string): S3Client {
		const s3 = captureAWSv3Client(new S3Client({ region }));
		return s3;
	}
}

class SSMClientFactory {
	public static create(region: string): SSMClient {
		const ssm = captureAWSv3Client(new SSMClient({ region }));
		return ssm;
	}
}

class LambdaClientFactory {
	public static create(region: string): LambdaClient {
		return captureAWSv3Client(new LambdaClient({ region }));
	}
}


const registerContainer = (app: FastifyInstance) => {
	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON
	};

	const awsRegion: string = process.env['AWS_REGION']!;
	const pipelineFunctionName = process.env['PIPELINE_API_FUNCTION_NAME']!;
	const pipelineProcessorFunctionName = process.env['PIPELINE_PROCESSOR_API_FUNCTION_NAME']!;
	const bucketName = process.env['DATA_BUCKET_NAME']!;
	const adminEmailAddress = process.env['SIF_ADMINISTRATOR_EMAIL']!;
	const dfSustainabilityRoleArn = process.env['DF_SUSTAINABILITY_ROLE_ARN'];

	const domainId = process.env['DATAZONE_DOMAIN_ID'];
	const athenaEnvironmentId = process.env['DATAZONE_ATHENA_ENVIRONMENT_ID'];

	const securityContext: LambdaRequestContext = {
		authorizer: {
			claims: {
				email: adminEmailAddress,
				'cognito:groups': `/|||admin`,
				groupContextId: '/'
			}
		}
	};

	diContainer.register({

		// Clients
		stepFunctionClient: asFunction(() => StepFunctionClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		stsClient: asFunction(() => STSClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		secretsManagerClient: asFunction(() => SecretsManagerClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		s3Client: asFunction(() => S3ClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		dataZoneClientFactory: asFunction((container: Cradle) => new DataZoneClientFactory(awsRegion, container.stsClient, dfSustainabilityRoleArn!), {
			...commonInjectionOptions
		}),


		ssmClient: asFunction(() => SSMClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		lambdaClient: asFunction(() => LambdaClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		invoker: asFunction((container: Cradle) => new Invoker(app.log, container.lambdaClient), {
			...commonInjectionOptions
		}),

		triggerPipelineService: asFunction((container: Cradle) => new TriggerPipelineService(app.log, container.s3Client, bucketName, container.pipelineClient, securityContext, container.executionClient, container.dataZoneClientFactory, domainId!, athenaEnvironmentId!), {
			...commonInjectionOptions
		}),

		checkPipelineService: asFunction((container: Cradle) => new CheckPipelineService(app.log, container.executionClient, securityContext), {
			...commonInjectionOptions
		}),

		pipelineClient: asFunction((container: Cradle) => new PipelineClient(app.log, container.invoker, pipelineFunctionName), {
			...commonInjectionOptions
		}),

		executionClient: asFunction((container: Cradle) => new ExecutionClient(app.log, container.invoker, pipelineProcessorFunctionName), {
			...commonInjectionOptions
		}),

		getSignedUrl: asValue(getSignedUrl)


	});
};

export default fp<FastifyAwilixOptions>(async (app: FastifyInstance): Promise<void> => {
	// first register the DI plugin
	await app.register(fastifyAwilixPlugin, {
		disposeOnClose: true,
		disposeOnResponse: false
	});

	registerContainer(app);
});

export { registerContainer };
