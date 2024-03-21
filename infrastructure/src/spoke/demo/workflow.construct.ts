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

import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export type WorkflowProps = {
	bucketName: string;
};

export class WorkflowConstruct extends Construct {
	constructor(scope: Construct, id: string, props: WorkflowProps) {
		super(scope, id);

		const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);

		// TODO: Create step function that processes the workflow (basically everything in the demo flow that was not already registered as source by other constructs)

		// 2 - Import US EPA Emission Factors into SIF

		// 5 - Mapping materials to EEIO emission factors

		// 6 - Publishing matched material NAICS to DF

		// 7 - Included in runtime workflow? Yes

		// 8 - Cleaned invoice data

		// 9 - Cleaned invoice data quality assertions

		// 10 - Scope 3 purchased goods & services
	}
}
