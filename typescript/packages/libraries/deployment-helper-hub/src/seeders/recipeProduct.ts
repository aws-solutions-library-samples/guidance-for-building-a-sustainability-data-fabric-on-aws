import type { CustomResource } from '../customResources/customResource.js';
import type { CustomResourceEvent } from '../customResources/customResource.model.js';
// @ts-ignore
import ow from 'ow';
import type { DataAssetClient, DFLambdaRequestContext, NewDataAssetTaskResource } from '@df-sustainability/clients';
import type { DataZoneMetadata } from '../plugins/awilix';
import type { BaseLogger } from 'pino';

export class RecipeProductSeeder implements CustomResource {

	public constructor(private readonly log: BaseLogger, private readonly dataAssetClient: DataAssetClient, private readonly dataZoneMetadata: DataZoneMetadata, private readonly requestContext: DFLambdaRequestContext) {
	}

	public async create(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`RecipeProductSeeder > create > customResourceEvent: ${customResourceEvent}`);
		ow(customResourceEvent.ResourceProperties, ow.object.nonEmpty);
		const { bucket, key, recipe, originalAssetName, ruleset } = customResourceEvent.ResourceProperties;
		await this.createAssetWithRecipe(bucket, key, recipe, originalAssetName, ruleset);
		this.log.info(`RecipeProductSeeder > create > exit`);
		return Promise.resolve(undefined);
	}

	public async delete(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`RecipeProductSeeder > delete > customResourceEvent: ${customResourceEvent}`);
		this.log.info(`RecipeProductSeeder > delete > exit`);
		return Promise.resolve(undefined);
	}

	public async update(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`RecipeProductSeeder > update > customResourceEvent: ${customResourceEvent}`);
		ow(customResourceEvent.ResourceProperties, ow.object.nonEmpty);
		const { bucket, key, recipe, originalAssetName, ruleset } = customResourceEvent.ResourceProperties;
		await this.createAssetWithRecipe(bucket, key, recipe, originalAssetName, ruleset);
		this.log.info(`RecipeProductSeeder > update > exit`);
		return Promise.resolve(undefined);
	}

	private async createAssetWithRecipe(bucket: string, key: string, recipe: { steps: any[] }, originalAssetName: string, ruleset: string): Promise<void> {
		this.log.trace(`RecipeProductSeeder > createAssetWithRecipe > in: bucket: ${bucket}, key: ${key}, recipe:${recipe}, originalAssetName: ${originalAssetName}`);
		if (key.endsWith('csv')) {
			const newDataAssetTaskResource = this.assembleCreateTaskWithRecipePayload(key, bucket, recipe, originalAssetName, ruleset);
			await this.dataAssetClient.create(newDataAssetTaskResource, this.requestContext);
			this.log.info(`RecipeProductSeeder > createAssetWithRecipe > newDataAssetTaskResource: ${JSON.stringify(newDataAssetTaskResource)}`);
		}
		this.log.trace(`RecipeProductSeeder > createAssetWithRecipe > exit >`);
	}

	private assembleCreateTaskWithRecipePayload(key: string, bucket: string, recipe: { steps: any[] }, originalAssetName: string, ruleset: string): NewDataAssetTaskResource {
		this.log.trace(`RecipeProductSeeder > assembleCreateTaskWithRecipePayload > in > key: ${key}, bucket: ${bucket}, recipe: ${JSON.stringify(recipe)}`);

		const fileName = key.split('/').pop();
		const extension = fileName.split('.').pop();

		const newDataAssetTaskResource: NewDataAssetTaskResource = {
			'catalog': {
				'assetName': `${originalAssetName}_transformed`,
				'autoPublish': true,
				'accountId': this.dataZoneMetadata.spokeAccountId,
				'domainId': this.dataZoneMetadata.domainId,
				'environmentId': this.dataZoneMetadata.athenaEnvironmentId,
				'domainName': this.dataZoneMetadata.domainName,
				'projectId': this.dataZoneMetadata.projectId,
				'revision': 1
			},
			'workflow': {
				'name': 'cleanup-invoice-recipe',
				'roleArn': this.dataZoneMetadata.roleArn,
				'dataset': {
					'name': originalAssetName,
					'format': extension === 'xlsx' ? 'excel' : 'csv',
					'connection': {
						'dataLake': {
							's3': {
								'path': `s3://${bucket}/${key}`,
								'region': this.dataZoneMetadata.region
							}
						}
					}
				},
				dataQuality: {
					ruleset
				},
				transforms: {
					recipe
				}
			}
		};

		this.log.trace(`RecipeProductSeeder > assembleCreateTaskWithRecipePayload > exit > newDataAssetTaskResource : ${JSON.stringify(newDataAssetTaskResource)}`);
		return newDataAssetTaskResource;
	}


}
