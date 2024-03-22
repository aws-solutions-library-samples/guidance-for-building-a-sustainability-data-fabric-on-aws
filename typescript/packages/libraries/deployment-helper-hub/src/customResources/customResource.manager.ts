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

import type { BaseLogger } from 'pino';
import type { CustomResource } from './customResource.js';
import type { CustomResourceEvent } from './customResource.model.js';
import type { UsepaProductSeeder } from '../seeders/useepaProduct.js';
import type { GeneralProductSeeder } from '../seeders/generalProduct.js';

export class CustomResourceManager {
	private readonly customResources: { [key: string]: CustomResource };

	public constructor(private readonly logger: BaseLogger, usepaProductSeeder: UsepaProductSeeder, generalProductSeeder: GeneralProductSeeder) {
		this.customResources = {
			'Custom::UsepaProductSeeder': usepaProductSeeder,
			'Custom::GeneralProductSeeder': generalProductSeeder
		};
	}

	public async create(event: CustomResourceEvent): Promise<unknown> {
		this.logger.info(`CustomResourceManager: create: event:${JSON.stringify(event)}`);
		return await this.customResources[event.ResourceType].create(event);
	}

	public async update(event: CustomResourceEvent): Promise<unknown> {
		this.logger.info(`CustomResourceManager: update: event:${JSON.stringify(event)}`);
		return await this.customResources[event.ResourceType].update(event);
	}

	public async delete(event: CustomResourceEvent): Promise<unknown> {
		this.logger.info(`CustomResourceManager: delete: event:${JSON.stringify(event)}`);
		return await this.customResources[event.ResourceType].delete(event);
	}
}
