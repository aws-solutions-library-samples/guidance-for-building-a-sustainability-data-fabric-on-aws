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

import { IVpc, SubnetSelection } from 'aws-cdk-lib/aws-ec2';

export interface RedshiftServerlessWorkgroupProps {
	readonly vpc: IVpc;
	readonly subnetSelection: SubnetSelection;
	readonly securityGroupIds: string;
	readonly baseCapacity: number;
	readonly workgroupName: string;
	readonly databaseName: string;
	readonly dataBucket: string;
}

interface RedshiftProps {
	readonly databaseName: string;
}

export interface RedshiftServerlessProps extends RedshiftProps {
	readonly workgroupName: string;
}

export interface ExistingRedshiftServerlessProps extends RedshiftServerlessProps {
	readonly workgroupId?: string;
	readonly namespaceId?: string;
	readonly dataAPIRoleArn: string;
}

export interface CustomProperties {
	readonly serverlessRedshiftProps?: ExistingRedshiftServerlessProps;
}

export type CreateSchema = CustomProperties & {
	readonly dataRoleName: string;
};

export type CopyS3Data = CustomProperties & {
	readonly redshiftRoleForCopyFromS3: string;
	readonly dataBucket: string;
};

export type NewNamespaceCustomProperties = RedshiftProps & {
	readonly adminRoleArn: string;
	readonly namespaceName: string;
};
export interface UserCredential {
	readonly username: string;
	readonly password: string;
}

export type AssociateIAMRoleToRedshift = CustomProperties & {
	readonly roleArn: string;
	readonly timeoutInSeconds: number;
};
