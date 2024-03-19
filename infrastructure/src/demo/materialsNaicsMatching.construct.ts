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

import { Stack, StackProps } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type MaterialsNaicsMatchingProps = StackProps & {
	bucketName: string;
};

export class MaterialsNaicsMatchingStack extends Stack {
	constructor(scope: Construct, id: string, props: MaterialsNaicsMatchingProps) {
		super(scope, id, props);

		const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);

		// Upload artifacts
		let dataPath = path.join(__dirname, '..', '..', '..', 'typescript', 'packages', 'demo', 'materialsNaicsMatching', 'resources');
		new BucketDeployment(this, 'MaterialsNaicsMatchingDeployment', {
			sources: [Source.asset(dataPath)],
			destinationBucket: bucket,
			destinationKeyPrefix: 'demo/materialsNaicsMatching',
		});

		// TODO: Create custom resource to call SIF to import the CaML pipeline definitions
	}
}
