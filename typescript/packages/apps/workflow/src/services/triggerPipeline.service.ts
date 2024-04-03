import type { ExecutionDetail, ExecutionDetailList, MultiPipelineTask, PipelineTask, SinglePipelineDataFabricTask, TriggerPipelineTask } from '../model';
import type { BaseLogger } from 'pino';
import type { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand, ListObjectsCommand } from '@aws-sdk/client-s3';
import type { ConnectorConfig, ExecutionClient, LambdaRequestContext, NewPipeline, PipelineClient } from '@df-sustainability/clients';
import axios from 'axios';
import type { DataZoneClientFactory } from '../plugins/module.awilix';
import { SearchListingsCommand } from '@aws-sdk/client-datazone';

export class TriggerPipelineService {

	constructor(private readonly log: BaseLogger,
				private readonly s3Client: S3Client,
				private readonly bucketName: string,
				private readonly pipelineClient: PipelineClient,
				private readonly securityContext: LambdaRequestContext,
				private readonly executionClient: ExecutionClient,
				private readonly dataZoneClientFactory: DataZoneClientFactory,
				private readonly domainId: string,
				private readonly environmentId: string
	) {
	}

	public async process(event: TriggerPipelineTask): Promise<[ExecutionDetailList, PipelineTask[]]> {
		this.log.info(`TriggerPipelineService > process > event: ${JSON.stringify(event)}`);
		if (event.tasks.length === 0) return [[], []];

		const tasks = event.tasks.sort((a, b) => b.priority - a.priority);
		const task = tasks.pop()!;

		const executions: ExecutionDetail[] = [];

		if (task.hasOwnProperty('sifResourceKey') && task.hasOwnProperty('resourceAssetName')) {
			const pipelineTask = task as SinglePipelineDataFabricTask;
			// Retrieve the asset listing id using the resource asset name.
			const dataZoneClient = await this.dataZoneClientFactory.create();
			const response = await dataZoneClient.send(new SearchListingsCommand({ domainIdentifier: this.domainId, searchText: pipelineTask.resourceAssetName }));
			const connectorOverrides = {
				'sif-dataFabric-pipeline-input-connector': {
					parameters: {
						'domainId': this.domainId,
						'environmentId': this.environmentId,
						'assetListingId': response.items?.[0]?.assetListing?.listingId!
					}
				}
			};
			await this.createDataFabricPipelineExecution(pipelineTask.sifResourceKey, connectorOverrides);
		} else if (task.hasOwnProperty('sifResourcesPrefix') && task.hasOwnProperty('resourcesPrefix')) {

			let productTasks: [string, string][] = await this.assemblePipelineTasks(task as MultiPipelineTask);
			for (const [pipelineDefinition, pipelineInput] of productTasks) {
				const pipelineExecution = await this.createPipelineExecution(pipelineDefinition, pipelineInput);
				if (pipelineExecution) {
					executions.push(pipelineExecution!);
				}
			}
		}


		this.log.info(`TriggerPipelineService > process > exit:`);
		return [executions, tasks];
	}

	private async assemblePipelineTasks(task: MultiPipelineTask): Promise<[string, string][]> {
		const results: [string, string][] = [];
		const pipelineDefinitionFiles = await this.s3Client.send(new ListObjectsCommand({ Bucket: this.bucketName, Prefix: task!.sifResourcesPrefix }));
		for (const object of pipelineDefinitionFiles.Contents ?? []) {
			const uploadFileKey = object.Key!.replace('.pipeline.json', '/data.csv').replace(task.sifResourcesPrefix, task.resourcesPrefix);
			results.push([object.Key!, uploadFileKey]);
		}
		return results;
	}

	private async createDataFabricPipelineExecution(pipelineDefinitionKey: string, connectorOverrides?: Record<string, ConnectorConfig>): Promise<ExecutionDetail | undefined> {

		this.log.info(`TriggerPipelineService > createPipelineExecution > pipelineDefinitionKey: ${pipelineDefinitionKey}, connectorOverrides: ${connectorOverrides}`);

		const createNewPipelineResource: NewPipeline = JSON.parse(await (await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: pipelineDefinitionKey }))).Body!.transformToString());

		// get the pipeline detail based on the pipeline name
		const existingPipeline = await this.pipelineClient.getByAlias(createNewPipelineResource.name, this.securityContext);

		let executionDetail: ExecutionDetail | undefined;

		if (existingPipeline) {
			// create the pipeline execution
			const execution = await this.executionClient.create(existingPipeline!.id, { actionType: 'create', mode: 'job', expiration: 600, connectorOverrides }, this.securityContext);

			executionDetail = { pipelineId: existingPipeline!.id, id: execution.id };

		}
		this.log.info(`TriggerPipelineService > process > exit: executionDetail: ${JSON.stringify(executionDetail)}`);
		return executionDetail;
	}

	private async createPipelineExecution(pipelineDefinitionKey: string, fileUploadKey: string, connectorOverrides?: Record<string, ConnectorConfig>): Promise<ExecutionDetail | undefined> {

		this.log.info(`TriggerPipelineService > createPipelineExecution > pipelineDefinitionKey: ${pipelineDefinitionKey}, fileUploadKey: ${fileUploadKey}`);

		const createNewPipelineResource: NewPipeline = JSON.parse(await (await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: pipelineDefinitionKey }))).Body!.transformToString());

		// get the pipeline detail based on the pipeline name
		const existingPipeline = await this.pipelineClient.getByAlias(createNewPipelineResource.name, this.securityContext);

		let executionDetail: ExecutionDetail | undefined;

		if (existingPipeline) {

			try {
				const uploadFile = await this.s3Client.send(new GetObjectCommand(
					{
						Bucket: this.bucketName,
						Key: fileUploadKey
					}));
				const fileContent = await uploadFile.Body!.transformToString();

				// create the pipeline execution
				const execution = await this.executionClient.create(existingPipeline!.id, { actionType: 'create', mode: 'job', expiration: 600, connectorOverrides }, this.securityContext);

				// upload the input file using the signed url
				await axios.put(execution.inputUploadUrl!, fileContent, {
					headers: {
						'Content-Type': 'text/csv'
					}
				});
				// return the execution details so we can poll it
				executionDetail = { pipelineId: existingPipeline!.id, id: execution.id };
			} catch (err) {
				if (err.name === 'NoSuchKey') {
					this.log.info(`TriggerPipelineService > process > error: file: ${fileUploadKey} does not exists`);
				} else {
					throw err;
				}
			}
		}
		this.log.info(`TriggerPipelineService > process > exit: executionDetail: ${JSON.stringify(executionDetail)}`);
		return executionDetail;
	}
}
