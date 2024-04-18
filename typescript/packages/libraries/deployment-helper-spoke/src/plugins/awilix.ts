/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { asFunction, createContainer, Lifetime } from 'awilix';
import pkg from 'aws-xray-sdk';
import { S3Client } from '@aws-sdk/client-s3';
import { GlueClient } from '@aws-sdk/client-glue';
import { CustomResourceManager } from '../customResources/customResource.manager.js';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Invoker, MetricClient, PipelineClient } from '@df-sustainability/clients';
import { LambdaClient } from '@aws-sdk/client-lambda';
import type { Cradle } from '@fastify/awilix';
import type { Logger } from 'pino';
import { pino } from 'pino';
import pretty from 'pino-pretty';
import { GeneralPipelineSeeder } from '../seeders/generalPipeline.js';

const { captureAWSv3Client } = pkg;

const container = createContainer({
	injectionMode: 'PROXY'
});

const logger: Logger = pino(
	pretty({
		colorize: true,
		translateTime: 'HH:MM:ss Z',
		ignore: 'pid,hostname'
	})
);

declare module '@fastify/awilix' {
	interface Cradle {
		secretsManagerClient: SecretsManagerClient;
		glueClient: GlueClient;
		s3Client: S3Client;
		invoker: Invoker;
		lambdaClient: LambdaClient;
		customResourceManager: CustomResourceManager;
		pipelineClient: PipelineClient;
		metricClient: MetricClient;
		generalPipelineSeeder: GeneralPipelineSeeder;
	}
}

class S3ClientFactory {
	public static create(region: string | undefined): S3Client {
		const s3 = captureAWSv3Client(new S3Client({ region }));
		return s3;
	}
}

class GlueClientFactory {
	public static create(region: string | undefined): GlueClient {
		const glueClient = captureAWSv3Client(new GlueClient({ region }));
		return glueClient;
	}
}


class SecretsManagerClientFactory {
	public static create(region: string | undefined): SecretsManagerClient {
		const secretsManagerClient = captureAWSv3Client(new SecretsManagerClient({ region }));
		return secretsManagerClient;
	}
}

class LambdaClientFactory {
	public static create(region: string): LambdaClient {
		return captureAWSv3Client(new LambdaClient({ region }));
	}
}

export interface DataZoneMetadata {
	domainId: string;
	domainName: string;
	athenaEnvironmentId: string;
	redshiftEnvironmentId: string;
	projectId: string;
	region: string;
	spokeAccountId: string;
	roleArn: string;
}

const awsRegion = process.env['AWS_REGION'];
const pipelineFunctionName = process.env['PIPELINE_API_FUNCTION_NAME'];
const adminEmailAddress = process.env['SIF_ADMINISTRATOR_EMAIL'];

const commonInjectionOptions = {
	lifetime: Lifetime.SINGLETON
};

container.register({

	logger: asFunction(() => logger, {
		...commonInjectionOptions
	}),

	s3Client: asFunction(() => S3ClientFactory.create(awsRegion), {
		...commonInjectionOptions
	}),
	lambdaClient: asFunction(() => LambdaClientFactory.create(awsRegion), {
		...commonInjectionOptions
	}),
	glueClient: asFunction(() => GlueClientFactory.create(awsRegion), {
		...commonInjectionOptions
	}),
	invoker: asFunction((container) => new Invoker(logger, container.lambdaClient), {
		...commonInjectionOptions
	}),
	secretsManagerClient: asFunction(() => SecretsManagerClientFactory.create(awsRegion), {
		...commonInjectionOptions
	}),
	customResourceManager: asFunction((container: Cradle) => new CustomResourceManager(logger, container.generalPipelineSeeder), {
		...commonInjectionOptions
	}),
	pipelineClient: asFunction((container: Cradle) => new PipelineClient(logger, container.invoker, pipelineFunctionName), {
		...commonInjectionOptions
	}),
	metricClient: asFunction((container: Cradle) => new MetricClient(logger, container.invoker, pipelineFunctionName), {
		...commonInjectionOptions
	}),
	generalPipelineSeeder: asFunction((container: Cradle) => new GeneralPipelineSeeder(logger, container.s3Client, container.pipelineClient, adminEmailAddress, container.metricClient), {
		...commonInjectionOptions
	})
});


export { container };
