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
import { STS } from '@aws-sdk/client-sts';
import type { App } from 'aws-cdk-lib';

const tryGetBooleanContext = (app: App, contextName: string, defaultValue: boolean): boolean => {
	const contextValue = app.node.tryGetContext(contextName);
	if (contextValue === undefined) return defaultValue;
	// if it's boolean return as it is
	if (typeof contextValue === 'boolean') return contextValue;
	// if it's string check if its equal to 'true'
	return contextValue === 'true';
};

function getOrThrow(app: App, name: string): string {
	const attribute = app.node.tryGetContext(name) as string;
	if (attribute === undefined) {
		throw new Error(`'${name}' is required`);
	}
	return attribute;
}

export interface DfAwsEnvironment {
	accountId?: string;
	region?: string;
}

const getDfAwsEnvironment = async (): Promise<DfAwsEnvironment> => {
	const sts = new STS({});

	let accountId, region;
	try {
		const callerIdentity = await sts.getCallerIdentity({});
		accountId = callerIdentity.Account;
		region = await sts.config.region();
	} catch (Exception) {
		console.log(`Could not retrieve caller identity when fetching environment`);
	}

	return {
		accountId, region
	};
};


export {
	tryGetBooleanContext,
	getOrThrow,
	getDfAwsEnvironment
};
