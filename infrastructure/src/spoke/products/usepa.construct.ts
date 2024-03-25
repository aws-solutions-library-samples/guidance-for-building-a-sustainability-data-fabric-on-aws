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

import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CustomResource } from 'aws-cdk-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type UsepaProperties = {
	bucketName: string;
	customResourceProviderToken: string;
};

export class UsepaInfrastructureConstruct extends Construct {
	readonly vpcId: string;

	constructor(scope: Construct, id: string, props: UsepaProperties) {
		super(scope, id);

		const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);

		// Upload USEPA spreadsheets and provenance to S3
		let dataPath = path.join(__dirname, '..', '..', '..', '..', 'typescript', 'packages', 'products', 'usepa', 'resources');
		new BucketDeployment(this, 'UsepaSourceDeployment', {
			sources: [Source.asset(dataPath)],
			destinationBucket: bucket,
			destinationKeyPrefix: 'products/usepa/original/'
		});

		// Upload extracted USEPA csv's to S3
		dataPath = path.join(__dirname, '..', '..', '..', '..', 'typescript', 'packages', 'products', 'usepa', 'generatedResources');
		new BucketDeployment(this, 'UsepaExtractedDeployment', {
			sources: [Source.asset(dataPath)],
			destinationBucket: bucket,
			destinationKeyPrefix: 'products/usepa/converted/'
		});


		// Upload pipeline definition to create USEPA impact factor to s3
		dataPath = path.join(__dirname, '..', '..', '..', '..', 'typescript', 'packages', 'products', 'usepa', 'sifResources');
		const pipelineDefinitionDeployment = new BucketDeployment(this, 'UsepaPipelineDefinitionDeployment', {
			sources: [Source.asset(dataPath)],
			destinationBucket: bucket,
			destinationKeyPrefix: 'products/usepa/sifResources/'
		});

		const customResource = new CustomResource(this, 'UsepaPipelineSeeder', {
			serviceToken: props.customResourceProviderToken,
			resourceType: 'Custom::GeneralPipelineSeeder',
			properties: {
				uniqueToken: Date.now(),
				prefix: 'products/usepa/sifResources',
				bucket: props.bucketName
			}
		});

		customResource.node.addDependency(pipelineDefinitionDeployment);
	}
}
