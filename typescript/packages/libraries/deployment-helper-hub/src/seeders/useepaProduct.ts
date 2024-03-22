import type { S3Client } from '@aws-sdk/client-s3';
import { ListObjectsCommand } from '@aws-sdk/client-s3';
import type { CustomResource } from '../customResources/customResource.js';
import type { CustomResourceEvent } from '../customResources/customResource.model.js';
// @ts-ignore
import ow from 'ow';
import type { DataAssetClient, NewDataAssetTaskResource, OpenLineageInput } from '@df-sustainability/clients';
import { DFLambdaRequestContext, getLambdaRequestContext } from '@df-sustainability/clients';
import type { DataZoneMetadata } from '../plugins/awilix';
import type { BaseLogger } from 'pino';

export class UsepaProductSeeder implements CustomResource {

	public constructor(private readonly log: BaseLogger, private readonly s3Client: S3Client, private readonly dataAssetClient: DataAssetClient, private readonly dataZoneMetadata: DataZoneMetadata, private readonly requestContext: DFLambdaRequestContext) {
	}

	public async create(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`ProductSeeder > create > customResourceEvent: ${customResourceEvent}`);

		ow(customResourceEvent.ResourceProperties, ow.object.nonEmpty);
		const { bucket, prefix } = customResourceEvent.ResourceProperties;

		try {
			await this.createAssets(bucket, prefix);
		} catch (err) {
			this.log.error(`ProductSeeder > create > err: ${JSON.stringify(err)}`);
		}

		this.log.info(`ProductSeeder > create > exit`);
		return Promise.resolve(undefined);
	}

	public async delete(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`ProductSeeder > delete > customResourceEvent: ${customResourceEvent}`);
		this.log.info(`ProductSeeder > delete > exit`);

		return Promise.resolve(undefined);
	}

	public async update(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`ProductSeeder > update > customResourceEvent: ${customResourceEvent}`);

		ow(customResourceEvent.ResourceProperties, ow.object.nonEmpty);
		const { bucket, prefix } = customResourceEvent.ResourceProperties;

		try {
			await this.createAssets(bucket, prefix);
		} catch (err) {
			this.log.error(`ProductSeeder > update > err: ${JSON.stringify(err)}`);
		}

		this.log.info(`ProductSeeder > update > exit`);

		return Promise.resolve(undefined);
	}

	private async createAssets(bucket: string, prefix: string): Promise<void> {
		/**
		 * Seed all the original files
		 */
		const listOriginalFilesResponse = await this.s3Client.send(new ListObjectsCommand({ Bucket: bucket, Prefix: `${prefix}/original` }));

		const assetNameByYear = {};

		const createOriginalFutures = [];

		for (const object of listOriginalFilesResponse.Contents) {
			if (object.Key.endsWith('csv') || object.Key.endsWith('xlsx')) {
				const newDataAssetTaskResource = this.assembleCreateDataAssetTaskPayload(object.Key, bucket, []);
				const { assetName } = newDataAssetTaskResource.catalog;
				// file looks like this ghg-emission-factors-hub-2023.xlsx
				const year = assetName.split('-').pop();
				assetNameByYear[year] = assetName;
				createOriginalFutures.push(this.dataAssetClient.create(newDataAssetTaskResource, getLambdaRequestContext('sdf_demo', 'sdf_demo')));
			}
		}

		await Promise.all(createOriginalFutures);

		/**
		 * Seed all the converted files.
		 */
		const listConvertedResponses = await this.s3Client.send(new ListObjectsCommand({ Bucket: bucket, Prefix: `${prefix}/converted` }));
		const createConvertedFutures = [];
		for (const object of listConvertedResponses.Contents) {
			if (object.Key.endsWith('csv') || object.Key.endsWith('xlsx')) {
				// sample full s3 path for file
				// s3://<bucketName>/products/usepa/converted/2023/electricity.csv
				const fileYear = object.Key.split('/')[3];
				const newDataAssetTaskResource = this.assembleCreateDataAssetTaskPayload(object.Key, bucket, [
					{
						assetName: assetNameByYear[fileYear],
						assetNamespace: this.getDomainNamespace({ name: this.dataZoneMetadata.domainName, id: this.dataZoneMetadata.domainId })
					}]);
				const { assetName } = newDataAssetTaskResource.catalog;
				// file looks like this ghg-emission-factors-hub-2023.xlsx
				const year = assetName.split('-').pop();
				assetNameByYear[year] = assetName;
				createConvertedFutures.push(this.dataAssetClient.create(newDataAssetTaskResource, this.requestContext));
			}
		}

		await Promise.all(createConvertedFutures);
	}


	private getDomainNamespace(domain: { name: string, id: string }) {
		return `df.${domain.name.replace(' ', '_')}-${domain.id}`;
	}

	private assembleCreateDataAssetTaskPayload(key: string, bucket: string, externalInputs: OpenLineageInput[]): NewDataAssetTaskResource {

		this.log.trace(`Product Seeder > assembleCreateDataAssetTaskPayload >`);

		const fileName = key.split('/').pop();
		const extension = fileName.split('.').pop();
		const assetName = fileName.replaceAll(/\.(csv|xlsx)/g, '');

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
					'name': fileName,
					'format': extension === 'xlsx' ? 'excel' : 'csv',
					'connection': {
						'dataLake': {
							's3': {
								'path': `s3://${bucket}/${key}`,
								'region': this.dataZoneMetadata.region
							}
						}
					}
				}
			}
		};

		this.log.trace(`Product Seeder > assembleCreateDataAssetTaskPayload > exit > newDataAssetTaskResource : ${JSON.stringify(newDataAssetTaskResource)}`);

		return newDataAssetTaskResource;
	}


}
