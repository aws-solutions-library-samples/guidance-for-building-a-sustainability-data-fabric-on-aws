import type { CustomResource } from '../customResources/customResource';
import type { BaseLogger } from 'pino';
import type { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand, ListObjectsCommand } from '@aws-sdk/client-s3';
import type { NewPipeline, PipelineClient } from '@df-sustainability/clients';
import type { CustomResourceEvent } from '../customResources/customResource.model.js';

export class UsepaPipelineSeeder implements CustomResource {


	public constructor(private readonly log: BaseLogger, private readonly s3Client: S3Client, private readonly pipelineClient: PipelineClient, private readonly adminEmailAddress: string) {
	}

	public async create(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`UsepaPipelineSeeder > create > customResourceEvent: ${customResourceEvent}`);
		const { bucket, prefix } = customResourceEvent.ResourceProperties;
		await this.seedPipelines(bucket, prefix);
		this.log.info(`UsepaPipelineSeeder > create > exit`);
		return Promise.resolve(undefined);
	}

	public async delete(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`UsepaPipelineSeeder > delete > customResourceEvent: ${customResourceEvent}`);
		this.log.info(`UsepaPipelineSeeder > delete > exit`);
		return Promise.resolve(undefined);
	}

	public async update(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`UsepaPipelineSeeder > update > customResourceEvent: ${customResourceEvent}`);
		const { bucket, prefix } = customResourceEvent.ResourceProperties;
		await this.seedPipelines(bucket, prefix);
		this.log.info(`UsepaPipelineSeeder > update > exit`);
		return Promise.resolve(undefined);
	}

	private async seedPipelines(bucket: string, prefix: string) {
		this.log.info(`UsepaPipelineSeeder > seedPipelines > bucket: ${bucket}, prefix: ${prefix}`);

		const securityContext = {
			authorizer: {
				claims: {
					email: this.adminEmailAddress,
					'cognito:groups': `/|||admin`,
					groupContextId: '/'
				}
			}
		};

		const listOriginalFilesResponse = await this.s3Client.send(new ListObjectsCommand({ Bucket: bucket, Prefix: `${prefix}` }));
		for (const object of listOriginalFilesResponse.Contents) {
			const createNewPipelineResource: NewPipeline = JSON.parse(await (await this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: object.Key }))).Body.transformToString());

			const existingPipeline = await this.pipelineClient.getByAlias(createNewPipelineResource.name, securityContext);
			if (existingPipeline) {
				await this.pipelineClient.delete(existingPipeline.id, securityContext);
			}

			await this.pipelineClient.create(createNewPipelineResource, securityContext);
		}
		this.log.info(`UsepaPipelineSeeder > update > seedPipeline> exit`);
	}
}
