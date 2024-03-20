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
import { UsepaInfrastructureConstruct } from '../products/usepa.construct.js';
import { DatagenInfrastructureConstruct } from './datagen.construct.js';
import { MaterialsNaicsMatchingConstruct } from './materialsNaicsMatching.construct.js';
import { SdfVpcConfig } from './network.construct.js';
import { Scope3PurchasedGoodsConstruct } from './scope3PurchaseGoods.construct.js';
import { WebsiteConstruct } from './website.construct.js';
import { WorkflowConstruct } from './workflow.construct.js';

export type DemoStackProperties = StackProps & {
	userVpcConfig?: SdfVpcConfig;
	bucketName: string;
};

export const redshiftUserParameter = `/df/sdfDemo/redshift/username`;

export class DemoInfrastructureStack extends Stack {
	readonly vpcId: string;

	constructor(scope: Construct, id: string, props: DemoStackProperties) {
		super(scope, id, props);

		// 2 - Import US EPA Emission Factors into SIF
		const usepa = new UsepaInfrastructureConstruct(this, 'UsepaInfrastructure', {
			bucketName: props.bucketName,
		});

		// 4 - SDF Demo Data Generation
		const datagen = new DatagenInfrastructureConstruct(this, 'Datagen', {
			userVpcConfig: props.userVpcConfig,
			bucketName: props.bucketName,
		});

		// 5 - Mapping materials to EEIO emission factors
		// 6 - Publishing matched material NAICS to DF
		const materialsNaicsMatching = new MaterialsNaicsMatchingConstruct(this, 'MaterialsNaicsMatching', {
			bucketName: props.bucketName,
		});

		// 10 - Scope 3 purchased goods & services
		const scope3PurchasedGoods = new Scope3PurchasedGoodsConstruct(this, 'Scope3PurchasedGoods', {
			bucketName: props.bucketName,
		});

		// deploy the website
		new WebsiteConstruct(this, 'Website', {});
		this.websiteNags();

		// once all infrastructure is deployed, deploy the worklow.construct and kick off an execution of the step function to process the remainder of the flow
		const workflow = new WorkflowConstruct(this, 'Workflow', {
			bucketName: props.bucketName,
		});
		workflow.node.addDependency(usepa);
		workflow.node.addDependency(datagen);
		workflow.node.addDependency(materialsNaicsMatching);
		workflow.node.addDependency(scope3PurchasedGoods);
	}

	private websiteNags() {
		NagSuppressions.addResourceSuppressionsByPath(
			this,
			['/SdfDemoStack/Website/SdfDemoWebsiteBucket/Resource', '/SdfDemoStack/Website/SdfDemoWebsiteBucket/Policy/Resource'],
			[
				{
					id: 'AwsSolutions-S1',
					reason: 'This is a demo application and does not require Access Logs',
				},
				{
					id: 'AwsSolutions-S10',
					reason: 'This is a demo application and does not require SSL',
				},
			],
			true
		);
		NagSuppressions.addResourceSuppressionsByPath(
			this,
			['/SdfDemoStack/Website/SdfWebsiteDistribution/CFDistribution'],
			[
				{
					id: 'AwsSolutions-CFR3',
					reason: 'This is a demo application and does not require Access Logs',
				},
				{
					id: 'AwsSolutions-CFR4',
					reason: 'This is a demo application and we need to support TLSV1 for now',
				},
			],
			true
		);
	}
}
