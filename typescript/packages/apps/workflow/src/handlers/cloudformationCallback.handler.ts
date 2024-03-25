import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from '../app.light';
import type { CloudFormationCallbackHandler, TriggerPipelineTask } from '../model';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { DescribeExecutionCommand, type SFNClient } from '@aws-sdk/client-sfn';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

export const handler: CloudFormationCallbackHandler = async (event, _context, _callback) => {
	app.log.debug(`Error > handler > event: ${JSON.stringify(event)}`);
	const sfnClient = di.resolve<SFNClient>('stepFunctionClient');

	const describeExecutionResponse = await sfnClient.send(new DescribeExecutionCommand({ executionArn: event.execution.executionId }));
	const inputPayload: TriggerPipelineTask = JSON.parse(describeExecutionResponse.input!);

	await axios.put(inputPayload.callbackUrl, {
		'Status': event?.Error ? 'FAILURE' : 'SUCCESS',
		'Reason': event?.Cause ?? 'Done',
		'UniqueId': randomUUID()
	});

	app.log.debug(`Error > handler > exit:`);
	return event;
};
