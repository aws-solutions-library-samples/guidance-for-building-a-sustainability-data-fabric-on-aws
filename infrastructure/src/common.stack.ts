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

import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export const bucketParameter = `/df/sdf/bucketName`;

export class CommonInfrastructureStack extends Stack {
	readonly bucketName: string;

	constructor(scope: Construct, id: string, props: StackProps) {
		super(scope, id, props);

		const accountId = Stack.of(this).account;
		const region = Stack.of(this).region;

		// bucket to store seeded data
		this.bucketName = `sdf-${accountId}-${region}-data`;
		const bucket = new Bucket(this, 'Bucket', {
			bucketName: this.bucketName,
			encryption: BucketEncryption.S3_MANAGED,
			intelligentTieringConfigurations: [
				{
					name: 'archive',
					archiveAccessTierTime: Duration.days(90),
					deepArchiveAccessTierTime: Duration.days(180),
				},
			],
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: true,
			versioned: false,
			serverAccessLogsPrefix: 'data',
			removalPolicy: RemovalPolicy.DESTROY,
		});

		new StringParameter(this, 'bucket', {
			parameterName: bucketParameter,
			stringValue: bucket.bucketName,
		});
	}
}
