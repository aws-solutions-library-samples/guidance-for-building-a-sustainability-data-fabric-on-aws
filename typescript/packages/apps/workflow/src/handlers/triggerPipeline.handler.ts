import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from '../app.light';
import type { TriggerPipelineEventHandler } from '../model';
import type { TriggerPipelineService } from '../services/triggerPipeline.service';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

export const handler: TriggerPipelineEventHandler = async (event, _context, _callback) => {
  app.log.debug(`TriggerPipeline > handler > event: ${JSON.stringify(event)}`);
  const task = di.resolve<TriggerPipelineService>('triggerPipelineService');
  const executionDetailList = await task.process(event);
  app.log.debug(`TriggerPipeline > handler > exit:`);
  return {
    ...event,
    executionDetailList
  };
};
