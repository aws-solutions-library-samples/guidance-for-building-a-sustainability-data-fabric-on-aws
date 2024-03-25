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
import { Construct } from 'constructs';
import { UsepaInfrastructureConstruct } from './usepa.construct.js';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { crHubProviderServiceTokenParameter } from '../common.stack.js';
import { UseeioInfrastructureConstruct } from './useeio.construct.js';

export type UseeioProperties = StackProps & {
  bucketName: string;
};

export class SpokeProductInfrastructureStack extends Stack {

  public constructor(scope: Construct, id: string, props: UseeioProperties) {
    super(scope, id, props);

    const customResourceProviderToken = StringParameter.fromStringParameterAttributes(this, 'customResourceProviderToken', {
      parameterName: crHubProviderServiceTokenParameter,
      simpleName: false
    }).stringValue;

    new UsepaInfrastructureConstruct(this, 'USEPA', {
      bucketName: props.bucketName,
      customResourceProviderToken
    });

    new UseeioInfrastructureConstruct(this, 'USEEIO', {
      bucketName: props.bucketName,
      customResourceProviderToken
    });
  }
}
