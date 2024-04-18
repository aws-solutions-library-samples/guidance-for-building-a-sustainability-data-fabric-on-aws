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
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { DatagenInfrastructureConstruct } from './datagen.construct.js';
import { MaterialsNaicsMatchingConstruct } from './materialsNaicsMatching.construct.js';
import { SdfVpcConfig } from './network.construct.js';
import { Scope3PurchasedGoodsConstruct } from './scope3PurchaseGoods.construct.js';
import { WebsiteConstruct } from './website.construct.js';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { crHubProviderServiceTokenParameter } from '../common.stack.js';

export type DemoStackProperties = StackProps & {
	userVpcConfig?: SdfVpcConfig;
	bucketName: string;
	hubAccountId: string;
	domainId: string;
	projectId: string;
	domainName: string;
};

export const redshiftUserParameter = `/df/sdfDemo/redshift/username`;

export class SpokeDemoInfrastructureStack extends Stack {
	readonly vpcId: string;

	constructor(scope: Construct, id: string, props: DemoStackProperties) {
		super(scope, id, props);

		const customResourceProviderToken = StringParameter.fromStringParameterAttributes(this, 'customResourceProviderToken', {
			parameterName: crHubProviderServiceTokenParameter,
			simpleName: false
		}).stringValue;

		// 4 - SDF Demo Data Generation
		const datagen = new DatagenInfrastructureConstruct(this, 'Datagen', {
			userVpcConfig: props.userVpcConfig,
			bucketName: props.bucketName,
			hubAccountId: props.hubAccountId,
			domainId: props.domainId,
			projectId: props.projectId
		});
		this.datagenNags();

		// 5 - Mapping materials to EEIO emission factors
		// 6 - Publishing matched material NAICS to DF
		const materialsNaicsMatching = new MaterialsNaicsMatchingConstruct(this, 'MaterialsNaicsMatching', {
			bucketName: props.bucketName,
			customResourceProviderToken,
			domainId: props.domainId,
			domainName: props.domainName

		});

		// 10 - Scope 3 purchased goods & services
		const scope3PurchasedGoods = new Scope3PurchasedGoodsConstruct(this, 'Scope3PurchasedGoods', {
			bucketName: props.bucketName,
			customResourceProviderToken
		});

		// deploy the website
		new WebsiteConstruct(this, 'Website', {});
		this.websiteNags();


	}

	private datagenNags() {
		NagSuppressions.addResourceSuppressionsByPath(
			this,
			['/SdfSpokeDemoStack/Datagen/RedshiftConfiguration/Resource', '/SdfSpokeDemoStack/Datagen/RedshiftCredentialsSecret/Resource'],
			[
				{
					id: 'AwsSolutions-SMG4',
					reason: 'This is a demo application and does not require secret rotation'
				}
			],
			true
		);
	}

	private websiteNags() {
		NagSuppressions.addResourceSuppressionsByPath(
			this,
			['/SdfSpokeDemoStack/Website/SdfDemoWebsiteBucket/Resource',
				'/SdfSpokeDemoStack/Website/SdfDemoWebsiteLogsBucket/Resource',
				'/SdfSpokeDemoStack/Website/SdfDemoWebsiteBucket/Policy/Resource'],
			[
				{
					id: 'AwsSolutions-S1',
					reason: 'This is a demo application and does not require Access Logs'
				},
				{
					id: 'AwsSolutions-S10',
					reason: 'This is a demo application and does not require SSL'
				}
			],
			true
		);
		NagSuppressions.addResourceSuppressionsByPath(
			this,
			['/SdfSpokeDemoStack/Website/SdfWebsiteDistribution/CFDistribution'],
			[
				{
					id: 'AwsSolutions-CFR3',
					reason: 'This is a demo application and does not require Access Logs'
				},
				{
					id: 'AwsSolutions-CFR4',
					reason: 'This is a demo application and we need to support TLSV1 for now'
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressionsByPath(
			this,
			['/SdfSpokeDemoStack/Website/SdfDemoWebsiteLogsBucket'],
			[
				{
					id: 'AwsSolutions-S10',
					reason: 'This is a demo application and does not require Access Logs'
				}
			],
			true
		);
	}
}
