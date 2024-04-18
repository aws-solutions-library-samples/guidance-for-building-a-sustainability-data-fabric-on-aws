import type { S3Client } from '@aws-sdk/client-s3';
import { ListObjectsCommand } from '@aws-sdk/client-s3';
import type { CustomResource } from '../customResources/customResource.js';
import type { CustomResourceEvent } from '../customResources/customResource.model.js';
// @ts-ignore
import ow from 'ow';
import type { DataAssetClient, DFLambdaRequestContext, NewDataAssetTaskResource } from '@df-sustainability/clients';
import type { DataZoneMetadata } from '../plugins/awilix';
import type { BaseLogger } from 'pino';


const fileToAssetNameMapping: Record<string, string> = {
	'scope-3-category-4-upstream-transportation-and-distribution-and-category-9-downstream-transportation-and-distribution': 'scope3-upstream-transportation',
	'scope-3-category-5-waste-generated-in-operations-and-category-12-end-of-life-treatment-of-sold-products': 'scope3-waste-generated',
	'scope-3-category-6-business-travel-and-category-7-employee-commuting': 'scope3-business-travel-employee-commuting'
};

export class UsepaProductSeeder implements CustomResource {

	public constructor(private readonly log: BaseLogger, private readonly s3Client: S3Client, private readonly dataAssetClient: DataAssetClient, private readonly dataZoneMetadata: DataZoneMetadata, private readonly requestContext: DFLambdaRequestContext) {
	}

	public async create(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`ProductSeeder > create > customResourceEvent: ${customResourceEvent}`);

		ow(customResourceEvent.ResourceProperties, ow.object.nonEmpty);
		const { bucket, prefix } = customResourceEvent.ResourceProperties;
		await this.createAssets(bucket, prefix);
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
		await this.createAssets(bucket, prefix);
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
				const newDataAssetTaskResource = this.assembleCreateDataAssetTaskPayload(object.Key, bucket);
				const { assetName } = newDataAssetTaskResource.catalog;
				// file looks like this ghg-emission-factors-hub-2023.xlsx
				const year = assetName.split('-').pop();
				assetNameByYear[year] = assetName;
				createOriginalFutures.push(this.dataAssetClient.create(newDataAssetTaskResource, this.requestContext));
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
				const newDataAssetTaskResource = this.assembleCreateDataAssetTaskPayload(object.Key, bucket, assetNameByYear[fileYear]);
				// file looks like this ghg-emission-factors-hub-2023.xlsx
				createConvertedFutures.push(this.dataAssetClient.create(newDataAssetTaskResource, this.requestContext));
			}
		}

		await Promise.all(createConvertedFutures);
	}

	private assembleCreateDataAssetTaskPayload(key: string, bucket: string, dependentAssetName?: string): NewDataAssetTaskResource {

		this.log.trace(`Product Seeder > assembleCreateDataAssetTaskPayload > in > key: ${key}, bucket: ${bucket}, dependentAssetName: ${dependentAssetName}`);

		const fileName = key.split('/').pop();
		const extension = fileName.split('.').pop();
		const folder = key.replaceAll(`/${fileName}`, '');
		let assetName = folder.split('/').pop();
		assetName = fileToAssetNameMapping[assetName] ?? assetName;

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
				'name': 's3_processing_workflow',
				'roleArn': this.dataZoneMetadata.roleArn,
				'dataset': {
					'name': dependentAssetName ?? `${assetName}.${extension}`,
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

		this.log.trace(`Product Seeder > assembleCreateDataAssetTaskPayload > exit > newDataAssetTaskResource : ${JSON.stringify(newDataAssetTaskResource)}`);

		return newDataAssetTaskResource;
	}


}
