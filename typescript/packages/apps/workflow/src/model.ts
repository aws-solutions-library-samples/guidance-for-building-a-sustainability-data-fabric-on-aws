import type { Handler } from 'aws-lambda/handler';
import type { Execution } from '@df-sustainability/clients/dist';

export interface TriggerPipelineTask {
  callbackUrl: string;
  usepa: {
    resourcesPrefix: string;
    sifResourcesPrefix: string;
  },
  useeio: {
    resourcesPrefix: string;
    sifResourcesPrefix: string;
  }
}

export type TaskExecutionDetails = {
  executionId: string,
  executionStartTime: string,
  stateMachineArn: string,
}

export interface TerminationEvent {
  Error?: string;
  Cause?: string;
  execution: TaskExecutionDetails;
}

export type ExecutionDetail = Pick<Execution, 'id' | 'pipelineId'>

export type ExecutionDetailList = ExecutionDetail[];

export type TriggerPipelineEventHandler = Handler<TriggerPipelineTask>;

export type CloudFormationCallbackHandler = Handler<TerminationEvent>;
