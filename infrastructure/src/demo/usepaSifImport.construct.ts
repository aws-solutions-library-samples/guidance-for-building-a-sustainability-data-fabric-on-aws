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
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type UsepaSifImport = {
	bucketName: string;
};

export class UsepaSifImportConstruct extends Construct {
	constructor(scope: Construct, id: string, props: UsepaSifImport) {
		super(scope, id);

		const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);

		// Upload SIF files ready for import
		let dataPath = path.join(__dirname, '..', '..', '..', '..', 'typescript', 'packages', 'demo', 'usepaSifImport', 'resources');
		new BucketDeployment(this, 'UsepaSifImportDeployment', {
			sources: [Source.asset(dataPath)],
			destinationBucket: bucket,
			destinationKeyPrefix: 'products/usepaSifImport',
		});

		// TODO: Create custom resource to call SIF to import the pipeline definitions
	}
}
