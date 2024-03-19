#!/usr/bin/env node

/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagPackSuppression, NagSuppressions } from 'cdk-nag';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DatagenInfrastructureStack } from './demo/datagen/datagen.stack.js';
import { UseeioInfrastructureStack } from './products/useeio/useeio.stack.js';
import { UsepaInfrastructureStack } from './products/usepa/usepa.stack.js';
import { commonCdkNagRules } from './utils/cfn-nag.js';
import { getOrThrow, tryGetBooleanContext } from './utils/util.js';
import { CommonInfrastructureStack } from './common.stack.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new cdk.App();

function stackSuppressions(stacks: cdk.Stack[], suppressions: NagPackSuppression[]) {
	stacks.forEach((s) => {
		NagSuppressions.addStackSuppressions(s, suppressions, true);
	});
}

// user VPC config (for demo infrastructure)
const useExistingVpc = tryGetBooleanContext(app, 'useExistingVpc', false);

let userVpcId, userIsolatedSubnetIds;
if (useExistingVpc) {
	userVpcId = getOrThrow(app, 'existingVpcId');
	userIsolatedSubnetIds = getOrThrow(app, 'existingIsolatedSubnetIds').toString().split(',');
}

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

const stackNameProducts = (suffix: string) => `sdf-${suffix}`;
const stackNameDemo = (suffix: string) => `sdf-demo-${suffix}`;
const stackDescription = (moduleName: string) => `Infrastructure for SDF ${moduleName} module`;

const commonInfrastructureStack = new CommonInfrastructureStack(app, 'SdfCommonStack', {
	stackName: stackNameProducts('common'),
	description: stackDescription('common'),
});

const deployPlatform = (callerEnvironment?: { accountId?: string; region?: string }): void => {
	stackSuppressions(
		[

			new UsepaInfrastructureStack(app, 'SdfUsepaStack', {
				stackName: stackNameProducts('usepa'),
				description: stackDescription('USEPA'),
				bucketName: commonInfrastructureStack.bucketName,
				env: {
					// The DF_REGION domain variable
					region: process.env?.['DF_REGION'] || callerEnvironment?.region,
					account: callerEnvironment?.accountId,
				},
			}),
			new UseeioInfrastructureStack(app, 'SdfUseeioStack', {
				stackName: stackNameProducts('useeio'),
				description: stackDescription('USEEIO'),
				bucketName: commonInfrastructureStack.bucketName,
				env: {
					// The DF_REGION domain variable
					region: process.env?.['DF_REGION'] || callerEnvironment?.region,
					account: callerEnvironment?.accountId,
				},
			}),
			new DatagenInfrastructureStack(app, 'SdfDemoDatagenStack', {
				stackName: stackNameDemo('datagen'),
				description: stackDescription('Datagen'),
				bucketName: commonInfrastructureStack.bucketName,
				userVpcConfig: useExistingVpc
					? {
							vpcId: userVpcId,
							isolatedSubnetIds: userIsolatedSubnetIds,
					  }
					: undefined,
				env: {
					// The DF_REGION domain variable
					region: process.env?.['DF_REGION'] || callerEnvironment?.region,
					account: callerEnvironment?.accountId,
				},
			}),
		],
		commonCdkNagRules
	);
};

const getCallerEnvironment = (): { accountId?: string; region?: string } | undefined => {
	if (!fs.existsSync(`${__dirname}/predeploy.json`)) {
		throw new Error('Pre deployment file does not exist\n' + 'Make sure you run the cdk using npm script which will run the predeploy script automatically\n' + 'EXAMPLE\n' + '$ npm run cdk deploy -- -e sampleEnvironment');
	}
	const { callerEnvironment } = JSON.parse(fs.readFileSync(`${__dirname}/predeploy.json`, 'utf-8'));
	return callerEnvironment;
};

deployPlatform(getCallerEnvironment());
