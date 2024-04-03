import type { BaseLogger } from 'pino';
import type { CheckPipelineTask } from '../model.js';
import type { ExecutionClient, LambdaRequestContext } from '@df-sustainability/clients';

export class CheckPipelineService {
  constructor(private readonly log: BaseLogger, private readonly executionService: ExecutionClient, private readonly requestContext: LambdaRequestContext) {
  }

  public async process(event: CheckPipelineTask): Promise<boolean> {
    this.log.info(`CheckPipelineService > process > event: ${JSON.stringify(event)}`);
    const pipelineResults = await Promise.all(event.executions.map(e => {
      return this.executionService.get(e.pipelineId, e.id, this.requestContext);
    }));

    this.log.info(`CheckPipelineService > process > exit:`);
    return pipelineResults.every(p => p.status === 'success' || p.status === 'failed');
  }

}
