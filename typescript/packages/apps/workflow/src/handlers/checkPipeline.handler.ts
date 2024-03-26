import type { CheckPipelineEventHandler } from '../model';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from '../app.light';
import type { AwilixContainer } from 'awilix';
import type { CheckPipelineService } from '../services/checkPipeline.service';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

export const handler: CheckPipelineEventHandler = async (event, _context, _callback) => {
  app.log.debug(`CheckPipeline > handler > event: ${JSON.stringify(event)}`);
  const task = di.resolve<CheckPipelineService>('checkPipelineService');
  const done = await task.process(event);
  app.log.debug(`CheckPipeline > handler > exit:`);
  return {
    ...event,
    done
  };
};
