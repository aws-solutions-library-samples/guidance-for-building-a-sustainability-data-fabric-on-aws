export const POWERTOOLS_ENVS = {
	POWERTOOLS_SERVICE_NAME: 'ClickStreamAnalyticsOnAWS',
	POWERTOOLS_LOGGER_SAMPLE_RATE: '1',
	POWERTOOLS_LOGGER_LOG_EVENT: 'true',
	LOG_LEVEL: 'WARN',
};

import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger();

export { logger };
