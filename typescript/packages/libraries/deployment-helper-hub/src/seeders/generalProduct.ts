import type { S3Client } from '@aws-sdk/client-s3';
import { ListObjectsCommand } from '@aws-sdk/client-s3';
import type { CustomResource } from '../customResources/customResource.js';
import type { CustomResourceEvent } from '../customResources/customResource.model.js';
// @ts-ignore
import ow from 'ow';
import type { DataAssetClient, DFLambdaRequestContext, NewDataAssetTaskResource, OpenLineageInput } from '@df-sustainability/clients';
import type { DataZoneMetadata } from '../plugins/awilix';
import type { BaseLogger } from 'pino';

export class GeneralProductSeeder implements CustomResource {

	public constructor(private readonly log: BaseLogger, private readonly s3Client: S3Client, private readonly dataAssetClient: DataAssetClient, private readonly dataZoneMetadata: DataZoneMetadata, private readonly requestContext: DFLambdaRequestContext) {
	}

	public async create(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`GeneralProductSeeder > create > customResourceEvent: ${customResourceEvent}`);

		ow(customResourceEvent.ResourceProperties, ow.object.nonEmpty);
		const { bucket, prefix } = customResourceEvent.ResourceProperties;

		try {
			await this.createAssets(bucket, prefix);
		} catch (err) {
			this.log.error(`GeneralProductSeeder > create > err: ${JSON.stringify(err)}`);
		}

		this.log.info(`GeneralProductSeeder > create > exit`);
		return Promise.resolve(undefined);
	}

	public async delete(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`GeneralProductSeeder > delete > customResourceEvent: ${customResourceEvent}`);
		this.log.info(`GeneralProductSeeder > delete > exit`);

		return Promise.resolve(undefined);
	}

	public async update(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`GeneralProductSeeder > update > customResourceEvent: ${customResourceEvent}`);

		ow(customResourceEvent.ResourceProperties, ow.object.nonEmpty);
		const { bucket, prefix } = customResourceEvent.ResourceProperties;

		try {
			await this.createAssets(bucket, prefix);
		} catch (err) {
			this.log.error(`GeneralProductSeeder > update > err: ${JSON.stringify(err)}`);
		}

		this.log.info(`GeneralProductSeeder > update > exit`);

		return Promise.resolve(undefined);
	}

	private async createAssets(bucket: string, prefix: string): Promise<void> {
		this.log.trace(`GeneralProductSeeder > createAssets > in: bucket: ${bucket}, prefix: ${prefix}`);
		const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
		/**
		 * Seed all the original files
		 */
		const listResourcesResponse = await this.s3Client.send(new ListObjectsCommand({ Bucket: bucket, Prefix: `${prefix}` }));
		for (const object of listResourcesResponse.Contents) {
			if (object.Key.endsWith('csv')) {
				const newDataAssetTaskResource = this.assembleCreateDataAssetTaskPayload(object.Key, bucket, []);
				await this.dataAssetClient.create(newDataAssetTaskResource, this.requestContext);
				await delay(3000);
				this.log.info(`GeneralProductSeeder > createAssets > newDataAssetTaskResource: ${JSON.stringify(newDataAssetTaskResource)}`);
			}
		}
		this.log.trace(`GeneralProductSeeder > createAssets > exit >`);
	}

	private assembleCreateDataAssetTaskPayload(key: string, bucket: string, externalInputs: OpenLineageInput[]): NewDataAssetTaskResource {

		this.log.trace(`GeneralProductSeeder > assembleCreateDataAssetTaskPayload >`);

		const fileName = key.split('/').pop();
		const extension = fileName.split('.').pop();
		const folder = key.replaceAll(`/${fileName}`, '');
		const assetName = folder.split('/').pop();

		const newDataAssetTaskResource: NewDataAssetTaskResource = {
			'catalog': {
				'assetName': assetName,
				'autoPublish': true,
				'accountId': this.dataZoneMetadata.spokeAccountId,
				'domainId': this.dataZoneMetadata.domainId,
				'environmentId': this.dataZoneMetadata.athenaEnvironmentId,
				'domainName': this.dataZoneMetadata.domainName,
				'projectId': this.dataZoneMetadata.projectId,
				'revision': 1
			},
			'workflow': {
				externalInputs,
				'name': 's3_processing_workflow',
				'roleArn': this.dataZoneMetadata.roleArn,
				'dataset': {
					'name': assetName,
					'format': extension === 'xlsx' ? 'excel' : 'csv',
					'connection': {
						'dataLake': {
							's3': {
								'path': `s3://${bucket}/${folder}`,
								'region': this.dataZoneMetadata.region
							}
						}
					}
				}
			}
		};

		this.log.trace(`GeneralProductSeeder > assembleCreateDataAssetTaskPayload > exit > newDataAssetTaskResource : ${JSON.stringify(newDataAssetTaskResource)}`);
		return newDataAssetTaskResource;
	}


}
