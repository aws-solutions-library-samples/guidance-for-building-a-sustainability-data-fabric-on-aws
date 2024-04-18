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

import { CdkCustomResourceEvent, CdkCustomResourceHandler, CdkCustomResourceResponse } from 'aws-lambda';
import { CreateSchema, UserCredential } from '../models.js';
import { logger } from '../utils/logger.js';
import { executeStatementsWithWait, getRedshiftClient } from '../redshift-data.js';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { aws_sdk_client_common_config } from '../utils/sdk-client-config.js';
import { REDSHIFT_CREDENTIAL_SECRET } from '../constants.js';

type ResourcePropertiesType = CreateSchema & {
	readonly ServiceToken: string;
};

const secretManagerClient: SecretsManagerClient = new SecretsManagerClient({
	...aws_sdk_client_common_config
});

export const handler: CdkCustomResourceHandler = async (event) => {
	const response: CdkCustomResourceResponse = {
		PhysicalResourceId: 'create-redshift-db-user-custom-resource',
		Data: {},
		Status: 'SUCCESS'
	};

	try {
		await _handler(event);
	} catch (e) {
		if (e instanceof Error) {
			logger.error('Error when creating database and schema in redshift', e);
		}
		throw e;
	}
	return response;
};

async function _handler(event: CdkCustomResourceEvent) {
	const requestType = event.RequestType;

	logger.info('RequestType: ' + requestType);
	if (requestType === 'Create' || requestType === 'Update') {
		await onCreate(event);
	}

	if (requestType === 'Delete') {
		await onDelete();
	}
}

async function onCreate(event: CdkCustomResourceEvent): Promise<void> {
	logger.info('onCreate()');

	const props = event.ResourceProperties as ResourcePropertiesType;

	const redshiftClient = getRedshiftClient(props.serverlessRedshiftProps!.dataAPIRoleArn);

	const secret = await secretManagerClient.send(
		new GetSecretValueCommand({
			SecretId: REDSHIFT_CREDENTIAL_SECRET
		})
	);

	const credential: UserCredential = JSON.parse(secret.SecretString);

	try {
		await executeStatementsWithWait(
			redshiftClient,
			[
				'CREATE SCHEMA sustainability',

				`CREATE TABLE sustainability.golden_materials (
					material_code varchar(32) PRIMARY KEY,
					material_name varchar(256),
					supplier_code varchar(32),
					supplier_name varchar(256)
				)`,

				'CREATE ROLE sustainability_readers',
				'GRANT USAGE ON SCHEMA sustainability TO ROLE sustainability_readers;',
				'GRANT SELECT ON ALL TABLES IN SCHEMA sustainability TO ROLE sustainability_readers',

				`CREATE USER "IAMR:${props.dataRoleName}" PASSWORD DISABLE`,
				`GRANT ROLE sustainability_readers TO "IAMR:${props.dataRoleName}"`,

				`CREATE USER ${credential.username} PASSWORD '${credential.password}'`,
				`GRANT ROLE sustainability_readers TO ${credential.username}`
			],
			props.serverlessRedshiftProps, true
		);
	} catch (err) {
		if (err instanceof Error) {
			logger.error('Error when creating database in serverless Redshift.', err);
		}
		throw err;
	}
}

async function onDelete(): Promise<void> {

}



