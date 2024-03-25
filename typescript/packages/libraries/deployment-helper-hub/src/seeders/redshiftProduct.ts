import type { CustomResource } from '../customResources/customResource';
import type { CustomResourceEvent } from '../customResources/customResource.model';
import type { BaseLogger } from 'pino';
// @ts-ignore
import ow from 'ow';
import type { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { DataAssetClient, DFLambdaRequestContext, NewDataAssetTaskResource } from '@df-sustainability/clients';
import { type DataZoneMetadata, getDomainNamespace } from '../plugins/awilix';

export interface RedshiftConfiguration {
	redshiftSecretArn: string;
	subnetId: string;
	securityGroupId: string;
	workgroupName: string;
	availabilityZone: string;
	path: string;
	databaseTableName: string;
	jdbcConnectionUrl: string;
}

export class RedshiftProductSeeder implements CustomResource {

	constructor(private readonly log: BaseLogger, private readonly secretManagerClient: SecretsManagerClient, private readonly dataZoneMetadata: DataZoneMetadata, private readonly dataAssetClient: DataAssetClient, private readonly requestContext: DFLambdaRequestContext) {
	}

	public async create(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`RedshiftProductSeeder > create > customResourceEvent: ${customResourceEvent}`);
		ow(customResourceEvent.ResourceProperties, ow.object.nonEmpty);
		const { secretArn, assetName, workflowName, assetInputs } = customResourceEvent.ResourceProperties;
		await this.createDataAsset(secretArn, assetName, workflowName, assetInputs);
		return Promise.resolve(undefined);
	}

	public async update(customResourceEvent: CustomResourceEvent): Promise<unknown> {
		this.log.info(`RedshiftProductSeeder > update > customResourceEvent: ${customResourceEvent}`);
		ow(customResourceEvent.ResourceProperties, ow.object.nonEmpty);
		const { secretArn, assetName, workflowName, assetInputs } = customResourceEvent.ResourceProperties;
		await this.createDataAsset(secretArn, assetName, workflowName, assetInputs);
		return Promise.resolve(undefined);
	}

	public async delete(_customResourceEvent: CustomResourceEvent): Promise<unknown> {
		return Promise.resolve(undefined);
	}


	private async createDataAsset(secretArn: string, assetName: string, workflowName: string, assetInputs: string[]): Promise<void> {
		this.log.info(`RedshiftProductSeeder > createDataAsset > secretArn: ${secretArn}, assetName: ${assetName}, workflowName: ${workflowName}`);
		const redshiftConfiguration = await this.getRedshiftConfiguration(secretArn);
		const newTaskResource = this.assembleNewDataAssetTaskResource(redshiftConfiguration, assetName, workflowName, assetInputs);
		this.log.info(`RedshiftProductSeeder > createDataAsset > newTaskResource: ${JSON.stringify(newTaskResource)}`);
		await this.dataAssetClient.create(newTaskResource, this.requestContext);
		this.log.info(`RedshiftProductSeeder > createDataAsset > redshiftConfiguration: ${redshiftConfiguration}, assetName: ${assetName}, workflowName: ${workflowName}`);
	}

	private async getRedshiftConfiguration(secretArn: string): Promise<RedshiftConfiguration> {
		this.log.trace(`RedshiftProductSeeder > getRedshiftConfiguration > secretArn: ${secretArn}`);
		const redshiftConfigurationSecret = await this.secretManagerClient.send(new GetSecretValueCommand({ SecretId: secretArn }));
		const redshiftConfiguration = JSON.parse(redshiftConfigurationSecret.SecretString);
		this.log.trace(`RedshiftProductSeeder > getRedshiftConfiguration > redshiftConfiguration: ${redshiftConfiguration}`);
		return redshiftConfiguration;
	}

	private assembleNewDataAssetTaskResource(redshiftConfiguration: RedshiftConfiguration, assetName: string, workflowName: string, assetInputs: string[]): NewDataAssetTaskResource {
		this.log.trace(`RedshiftProductSeeder > assembleNewDataAssetTaskResource > redshiftConfiguration: ${redshiftConfiguration}, assetName: ${assetName}, workflowName: ${workflowName}`);

		const newDataAssetTaskResource: NewDataAssetTaskResource = {
			'catalog': {
				'assetName': assetName,
				'autoPublish': true,
				'accountId': this.dataZoneMetadata.spokeAccountId,
				'domainId': this.dataZoneMetadata.domainId,
				'environmentId': this.dataZoneMetadata.redshiftEnvironmentId,
				'domainName': this.dataZoneMetadata.domainName,
				'projectId': this.dataZoneMetadata.projectId,
				'revision': 1
			},
			'workflow': {
				'name': workflowName,
				'roleArn': this.dataZoneMetadata.roleArn,
				externalInputs: assetInputs.map(a => (
					{
						assetName: a,
						assetNamespace: getDomainNamespace({
							name: this.dataZoneMetadata.domainName,
							id: this.dataZoneMetadata.domainId
						})
					})),
				'dataset': {
					'name': `redshift-${assetName}-dataset`,
					'format': 'json',
					'connection': {
						'redshift': {
							'secretArn': redshiftConfiguration.redshiftSecretArn,
							'jdbcConnectionUrl': redshiftConfiguration.jdbcConnectionUrl,
							'subnetId': redshiftConfiguration.subnetId,
							'securityGroupIdList': [
								redshiftConfiguration.securityGroupId
							],
							'availabilityZone': redshiftConfiguration.availabilityZone,
							'path': redshiftConfiguration.path,
							'workgroupName': redshiftConfiguration.workgroupName,
							'databaseTableName': redshiftConfiguration.databaseTableName
						}
					}
				}
			}
		};
		this.log.trace(`RedshiftProductSeeder > assembleNewDataAssetTaskResource > exit > newDataAssetTaskResource: ${newDataAssetTaskResource}`);
		return newDataAssetTaskResource;
	}
}
