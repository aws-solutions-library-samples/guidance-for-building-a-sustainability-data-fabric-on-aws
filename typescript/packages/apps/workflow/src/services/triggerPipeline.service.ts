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

    const executions: ExecutionDetail[] = [];
    for (const object of pipelineDefinitionFiles.Contents ?? []) {
      const uploadFileKey = object.Key!.replace('pipeline.json', 'csv').replace(event.useeio.sifResourcesPrefix, event.useeio.resourcesPrefix);
      const pipelineExecution = await this.createPipelineExecution(object.Key!, uploadFileKey);
      if (!pipelineExecution) {
        executions.push(pipelineExecution!);
      }
    }

    this.log.info(`TriggerPipelineService > process > exit:`);
    return executions;
  }


  private async createPipelineExecution(pipelineDefinitionKey: string, fileUploadKey: string): Promise<ExecutionDetail | undefined> {

    const securityContext = {
      authorizer: {
        claims: {
          email: this.adminEmailAddress,
          'cognito:groups': `/|||admin`,
          groupContextId: '/'
        }
      }
    };

    const createNewPipelineResource: NewPipeline = JSON.parse(await (await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: pipelineDefinitionKey }))).Body!.transformToString());

    // get the pipeline detail based on the pipeline name
    const existingPipeline = await this.pipelineClient.getByAlias(createNewPipelineResource.name, securityContext);

    if (existingPipeline) {
      // create the pipeline execution
      const execution = await this.executionClient.create(existingPipeline!.id, { actionType: 'create', mode: 'job', expiration: 600 }, securityContext);
      // get the uploaded file
      const uploadFile = await this.s3Client.send(new GetObjectCommand(
        {
          Bucket: this.bucketName,
          Key: fileUploadKey
        }));
      const fileContent = await uploadFile.Body!.transformToString();
      // upload the input file using the signed url
      await axios.put(execution.inputUploadUrl!, fileContent, {
        headers: {
          'Content-Type': 'text/csv'
        }
      });
      // return the execution details so we can poll it
      return { pipelineId: existingPipeline!.id, id: execution.id };
    } else {
      this.log.info(`TriggerPipelineService > process > error: pipeline ${createNewPipelineResource.name} not exist`);
      return undefined;
    }
  }
}
