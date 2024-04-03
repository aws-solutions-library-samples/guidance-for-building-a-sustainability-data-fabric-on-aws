import type { Handler } from 'aws-lambda/handler';
import type { Execution } from '@df-sustainability/clients';


export interface MultiPipelineTask {
	priority: number;
	resourcesPrefix: string;
	sifResourcesPrefix: string;
}

export interface SinglePipelineCsvTask {
	priority: number;
	sifResourceKey: string;
	resourceKey: string;
}

export interface SinglePipelineDataFabricTask {
	priority: number;
	sifResourceKey: string;
	resourceAssetName: string;
}

export type PipelineTask = MultiPipelineTask | SinglePipelineCsvTask | SinglePipelineDataFabricTask;

export interface TriggerPipelineTask {
	callbackUrl: string;
	tasks: PipelineTask[];
}

export interface CheckPipelineTask {
	callbackUrl: string;
	tasks: PipelineTask[];
	executions: ExecutionDetailList;
	executionsCount: number;
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

export type TriggerPipelineEventHandler = Handler<TriggerPipelineTask, CheckPipelineTask>;

export type CheckPipelineEventHandler = Handler<CheckPipelineTask, TriggerPipelineTask & { done: boolean }>;

export type CloudFormationCallbackHandler = Handler<TerminationEvent>;
