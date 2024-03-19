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

import { CfnResource, RemovalPolicy } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { addCfnNagSuppressRules, ruleToSuppressCloudWatchLogEncryption } from '../../../utils/cfn-nag.js';


export function createLogGroup(
	scope: Construct,
	props: {
		prefix: string;
		retention?: RetentionDays;
		removalPolicy?: RemovalPolicy;
	}
): LogGroup {
	const logGroup = new LogGroup(scope, `LogGroup-${props.prefix}`, {
		logGroupName: props.prefix,
		retention: props.retention ?? RetentionDays.ONE_WEEK,
		removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
	});
	addCfnNagSuppressRules(logGroup.node.defaultChild as CfnResource, [ruleToSuppressCloudWatchLogEncryption()]);
	return logGroup;
}
