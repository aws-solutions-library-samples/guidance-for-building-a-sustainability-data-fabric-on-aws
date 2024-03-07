#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagPackSuppression, NagSuppressions } from 'cdk-nag';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DatagenInfrastructureStack } from './datagen/datagen.stack.js';
import { getOrThrow, tryGetBooleanContext } from './utils/util.js';
import { commonCdkNagRules } from './datagen/redshift/cfn-nag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new cdk.App();

function stackSuppressions(stacks: cdk.Stack[], suppressions: NagPackSuppression[]) {
	stacks.forEach(s => {
	  NagSuppressions.addStackSuppressions(s, suppressions, true);
	});
  }

// user VPC config
const useExistingVpc = tryGetBooleanContext(app, 'useExistingVpc', false);

let userVpcId, userIsolatedSubnetIds;
if (useExistingVpc) {
	userVpcId = getOrThrow(app, 'existingVpcId');
	userIsolatedSubnetIds = getOrThrow(app, 'existingIsolatedSubnetIds').toString().split(',');
}

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

const stackNamePrefix = `sdfDemo`;

const stackName = (suffix: string) => `${stackNamePrefix}-${suffix}`;
const stackDescription = (moduleName: string) => `Infrastructure for SDF Demo ${moduleName} module`;

const deployPlatform = (callerEnvironment?: { accountId?: string; region?: string }): void => {
	stackSuppressions([
		new DatagenInfrastructureStack(app, 'SdfDemoDatagenStack', {
			stackName: stackName('datagen'),
			description: stackDescription('Datagen'),
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
	], commonCdkNagRules);
};

const getCallerEnvironment = (): { accountId?: string; region?: string } | undefined => {
	if (!fs.existsSync(`${__dirname}/predeploy.json`)) {
		throw new Error('Pre deployment file does not exist\n' + 'Make sure you run the cdk using npm script which will run the predeploy script automatically\n' + 'EXAMPLE\n' + '$ npm run cdk deploy -- -e sampleEnvironment');
	}
	const { callerEnvironment } = JSON.parse(fs.readFileSync(`${__dirname}/predeploy.json`, 'utf-8'));
	return callerEnvironment;
};

deployPlatform(getCallerEnvironment());
