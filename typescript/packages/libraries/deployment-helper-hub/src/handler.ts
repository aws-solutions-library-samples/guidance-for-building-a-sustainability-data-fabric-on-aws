/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { container } from './plugins/awilix.js';
import type { Logger } from 'pino';
import type { CustomResourceManager } from './customResources/customResource.manager.js';

const logger = container.resolve<Logger>('logger');

export const handler: any = async (event: any, _context, _callback): Promise<void> => {
	logger.info(`deploymentHelper > handler > in> event: ${JSON.stringify(event)}`);
	try {
		const customResourceManager = container.resolve<CustomResourceManager>('customResourceManager');
		await customResourceManager[event.RequestType.toLowerCase()](event);
	} catch (Exception) {
		logger.error(`deploymentHelper > handler > error: ${Exception}`);
	}
};
