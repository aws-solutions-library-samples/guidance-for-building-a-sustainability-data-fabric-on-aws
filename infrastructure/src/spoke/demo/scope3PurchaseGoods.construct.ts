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
import { CustomResource } from 'aws-cdk-lib';
import path from 'path';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { fileURLToPath } from 'url';

export type Scope3PurchasedGoodsProps = {
	bucketName: string;
	customResourceProviderToken: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Scope3PurchasedGoodsConstruct extends Construct {
	constructor(scope: Construct, id: string, props: Scope3PurchasedGoodsProps) {
		super(scope, id);

		const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);

		let dataPath = path.join(__dirname, '..', '..', '..', '..', 'typescript', 'packages', 'demo', 'scope3PurchasedGoods', 'sifResources');
		const resourceDeployment = new BucketDeployment(this, 'Scope3PurchasedGoodsResourceDeployment', {
			sources: [Source.asset(dataPath)],
			destinationBucket: bucket,
			destinationKeyPrefix: 'demo/scope3PurchasedGoods/sifResources/'
		});

		const customResource = new CustomResource(this, 'Scope3PurchasedGoodsSeeder', {
			serviceToken: props.customResourceProviderToken,
			resourceType: 'Custom::GeneralPipelineSeeder',
			properties: {
				uniqueToken: Date.now(),
				prefix: 'demo/scope3PurchasedGoods/sifResources',
				bucket: props.bucketName
			}
		});

		customResource.node.addDependency(resourceDeployment);
	}
}
