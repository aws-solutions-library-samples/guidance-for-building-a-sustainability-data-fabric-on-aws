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
import { commonCdkNagRules } from './utils/cfn-nag.js';
import { getOrThrow, tryGetBooleanContext } from './utils/util.js';
import { SpokeProductInfrastructureStack } from './spoke/products/product.stack.js';
import { SpokeDemoInfrastructureStack } from './spoke/demo/demo.stack.js';
import { CommonInfrastructureStack } from './spoke/common.stack.js';
import { CommonHubInfrastructureStack } from './hub/common.stack.js';
import { HubProductInfrastructureStack } from './hub/products/product.stack.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename: string = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname: string = path.dirname(__filename);

const app = new cdk.App();

function stackSuppressions(stacks: cdk.Stack[], suppressions: NagPackSuppression[]): void {
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

const hubAccountId = getOrThrow(app, 'hubAccountId');
const spokeAccountId = getOrThrow(app, 'spokeAccountId');

const getCallerEnvironment = (): { accountId?: string; region?: string } | undefined => {
  if (!fs.existsSync(`${__dirname}/predeploy.json`)) {
    throw new Error('Pre deployment file does not exist\n' + 'Make sure you run the cdk using npm script which will run the predeploy script automatically\n' + 'EXAMPLE\n' + '$ npm run cdk deploy -- -e sampleEnvironment');
  }
  const { callerEnvironment } = JSON.parse(fs.readFileSync(`${__dirname}/predeploy.json`, 'utf-8'));
  return callerEnvironment;
};
const callerEnvironment = getCallerEnvironment();

const region: string = process.env?.['DF_REGION'] || callerEnvironment?.region;

const hubEnvironment = { region, account: hubAccountId };
const spokeEnvironment = { region, account: spokeAccountId };

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

const spokeBucketName = `sdf-${spokeAccountId}-${region}-data`;

/**
 * Stack deployed in the spoke account. This is where SIF is deployed
 */

const commonInfrastructureStack = new CommonInfrastructureStack(app, 'SdfCommonStack', {
  stackName: 'sdf-common',
  description: 'Infrastructure shared between SDF and SDF demo.',
  hubAccountId: hubAccountId,
  spokeBucketName
});

const products = new SpokeProductInfrastructureStack(app, 'SdfProductStack', {
  stackName: 'sdf-products',
  description: 'Infrastructure for SDF data products.',
  bucketName: commonInfrastructureStack.bucketName,
  env: spokeEnvironment
});

const demos = new SpokeDemoInfrastructureStack(app, 'SdfDemoStack', {
  stackName: 'sdf-demo',
  description: 'Infrastructure for SDF demo.',
  bucketName: commonInfrastructureStack.bucketName,
  env: spokeEnvironment
});
demos.addDependency(products);

/**
 * Stack deployed in the hub account. This is where SIF is deployed
 */
const domainId = getOrThrow(app, 'domainId');
const domainName = getOrThrow(app, 'domainName');
const projectId = getOrThrow(app, 'projectId');
const athenaEnvironmentId = getOrThrow(app, 'athenaEnvironmentId');
const redshiftEnvironmentId = getOrThrow(app, 'redshiftEnvironmentId');
const roleArn = getOrThrow(app, 'roleArn');

const commonHubInfrastructureStack = new CommonHubInfrastructureStack(app, 'SdfHubCommonStack', {
  domainId,
  domainName,
  projectId,
  athenaEnvironmentId,
  redshiftEnvironmentId,
  roleArn,
  spokeAccountId,
  spokeBucketArn: `arn:aws:s3:::${spokeBucketName}`,
  env: hubEnvironment
});

const hubProductInfrastructureStack = new HubProductInfrastructureStack(app, 'SdfHubProductStack', {
  bucketName: spokeBucketName
});

hubProductInfrastructureStack.addDependency(commonHubInfrastructureStack);

stackSuppressions([products, demos], commonCdkNagRules);
