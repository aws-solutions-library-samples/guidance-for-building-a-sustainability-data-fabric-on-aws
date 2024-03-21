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
import type { LambdaRequestContext } from '../../common/models';
import { Invoker, LambdaApiGatewayEventBuilder } from '../../common/invoker';
import { ClientServiceBase } from '../../common/common.js';
import type { DataAssetTaskResource, DataAssetTaskResourceList, NewDataAssetTaskResource } from './dataAsset.model.js';


export interface DFLambdaRequestContext {
	authorizer: {
		claims: {
			email: string;
			identities: string
		};
	};
}

export const getLambdaRequestContext = (email: string, userId: string): DFLambdaRequestContext => ({
	authorizer: {
		claims: {
			email: email,
			identities: JSON.stringify({ userId })
		}
	}
});

export class DataAssetClient extends ClientServiceBase {

	constructor(private log: BaseLogger, private lambdaInvoker: Invoker, private dataAssetFunctionName: string) {
		super();
	}

	public async create(newTask: NewDataAssetTaskResource, requestContext?: DFLambdaRequestContext): Promise<DataAssetTaskResource> {
		this.log.info(`DataAssetClient> create> in> newTask: ${newTask}`);

		const additionalHeaders = {};

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('POST')
			.setRequestContext(requestContext)
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setBody(newTask)
			.setPath(`dataAssetTasks`);

		const result = await this.lambdaInvoker.invoke(this.dataAssetFunctionName, event);
		this.log.info(`DataAssetClient> create> exit> result: ${JSON.stringify(result)}`);
		return result.body as DataAssetTaskResource;
	}

	public async get(taskId: string, requestContext?: LambdaRequestContext, verbose = true): Promise<DataAssetTaskResource> {
		this.log.info(`DataAssetClient > get > in > taskId: ${taskId}`);
		const additionalHeaders = {};
		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setRequestContext(requestContext)
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setPath(`dataAssetTasks/${taskId}`)
			.setQueryStringParameters({
				verbose: verbose.toString()
			});
		const result = await this.lambdaInvoker.invoke(this.dataAssetFunctionName, event);
		this.log.info(`DataAssetClient > get > exit > result: ${JSON.stringify(result)}`);
		return result.body as DataAssetTaskResource;
	}

	public async list(requestContext?: LambdaRequestContext, verbose = true): Promise<DataAssetTaskResourceList> {
		this.log.info(`DataAssetClient > list > in >`);
		const additionalHeaders = {};
		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setRequestContext(requestContext)
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setPath(`dataAssetTasks`)
			.setQueryStringParameters({
				verbose: verbose.toString()
			});
		const result = await this.lambdaInvoker.invoke(this.dataAssetFunctionName, event);
		this.log.info(`DataAssetClient > list > exit > result: ${JSON.stringify(result)}`);
		return result.body as DataAssetTaskResourceList;
	}
}

