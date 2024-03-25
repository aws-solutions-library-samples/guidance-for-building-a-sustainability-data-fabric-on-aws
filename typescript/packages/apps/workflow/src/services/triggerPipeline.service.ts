import type { ExecutionDetail, ExecutionDetailList, TriggerPipelineTask } from '../model';
import type { BaseLogger } from 'pino';
import type { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand, ListObjectsCommand } from '@aws-sdk/client-s3';
import type { ExecutionClient, NewPipeline, PipelineClient } from '@df-sustainability/clients';
import axios from 'axios';

export class TriggerPipelineService {

  constructor(private readonly log: BaseLogger,
              private readonly s3Client: S3Client,
              private readonly bucketName: string,
              private readonly pipelineClient: PipelineClient,
              private readonly adminEmailAddress: string,
              private readonly executionClient: ExecutionClient) {
  }

  public async process(event: TriggerPipelineTask): Promise<ExecutionDetailList> {
    this.log.info(`TriggerPipelineService > process > event: ${JSON.stringify(event)}`);

    const pipelineDefinitionFiles = await this.s3Client.send(new ListObjectsCommand({ Bucket: this.bucketName, Prefix: event.useeio.sifResourcesPrefix }));

    const securityContext = {
      authorizer: {
        claims: {
          email: this.adminEmailAddress,
          'cognito:groups': `/|||admin`,
          groupContextId: '/'
        }
      }
    };

    const executions: ExecutionDetail[] = [];

    for (const object of pipelineDefinitionFiles.Contents ?? []) {
      const createNewPipelineResource: NewPipeline = JSON.parse(await (await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: object.Key! }))).Body!.transformToString());
      const existingPipeline = await this.pipelineClient.getByAlias(createNewPipelineResource.name, securityContext);

      if (existingPipeline) {
        const execution = await this.executionClient.create(existingPipeline!.id, { actionType: 'create', mode: 'job', expiration: 600 }, securityContext);
        const uploadFile = await this.s3Client.send(new GetObjectCommand(
          {
            Bucket: this.bucketName,
            Key: object.Key!.replace('pipeline.json', 'csv').replace(event.useeio.sifResourcesPrefix, event.useeio.resourcesPrefix)
          }));

        const fileContent = await uploadFile.Body!.transformToString();

        await axios.put(execution.inputUploadUrl!, fileContent, {
          headers: {
            'Content-Type': 'text/csv'
          }
        });
        executions.push({ pipelineId: existingPipeline!.id, id: execution.id });
      } else {
        this.log.info(`TriggerPipelineService > process > error: pipeline ${createNewPipelineResource.name} not exist`);
      }

    }

    this.log.info(`TriggerPipelineService > process > exit:`);
    return executions;
  }
}
