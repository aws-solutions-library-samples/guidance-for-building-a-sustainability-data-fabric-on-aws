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

import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import path from 'path';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { CustomResource } from 'aws-cdk-lib';
import { fileURLToPath } from 'url';

export type MaterialsNaicsMatchingProps = {
	bucketName: string;
	customResourceProviderToken: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MaterialsNaicsMatchingConstruct extends Construct {
	constructor(scope: Construct, id: string, props: MaterialsNaicsMatchingProps) {
		super(scope, id);

		// TODO: Create custom resource to call SIF to create the CaML pipeline definitions

		const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);

		let dataPath = path.join(__dirname, '..', '..', '..', '..', 'typescript', 'packages', 'demo', 'materialsNaicsMatching', 'resources');

		const resourceDeployment = new BucketDeployment(this, 'MaterialsNaicsMatchingResourceDeployment', {
			sources: [Source.asset(dataPath)],
			destinationBucket: bucket,
			destinationKeyPrefix: 'demo/materialsNaicsMatching/resources/'
		});

		dataPath = path.join(__dirname, '..', '..', '..', '..', 'typescript', 'packages', 'demo', 'materialsNaicsMatching', 'sifResources');
		const sifResourcesDeployment = new BucketDeployment(this, 'MaterialsNaicsMatchingSifResourceDeployment', {
			sources: [Source.asset(dataPath)],
			destinationBucket: bucket,
			destinationKeyPrefix: 'demo/materialsNaicsMatching/sifResources/'
		});

		const customResource = new CustomResource(this, 'MaterialsNaicsMatchingSeeder', {
			serviceToken: props.customResourceProviderToken,
			resourceType: 'Custom::GeneralPipelineSeeder',
			properties: {
				uniqueToken: Date.now(),
				prefix: 'demo/materialsNaicsMatching/sifResources',
				bucket: props.bucketName
			}
		});

		customResource.node.addDependency(sifResourcesDeployment);
	}
}
