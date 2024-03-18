import { CdkCustomResourceEvent, CdkCustomResourceHandler, CdkCustomResourceResponse } from 'aws-lambda';
import { CreateSchema, UserCredential } from '../models.js';
import { logger } from '../utils/logger.js';
import { executeStatementsWithWait, getRedshiftClient } from '../redshift-data.js';
import * as randomstring from 'randomstring';
import { CreateSecretCommand, CreateSecretCommandInput, DeleteSecretCommand, DeleteSecretCommandInput, DescribeSecretCommand, DescribeSecretCommandInput, ResourceNotFoundException, SecretsManagerClient, UpdateSecretCommand, UpdateSecretCommandInput } from '@aws-sdk/client-secrets-manager';
import { aws_sdk_client_common_config } from '../utils/sdk-client-config.js';
import { REDSHIFT_CREDENTIAL_SECRET, REDSHIFT_USERNAME } from '../constants.js';

type ResourcePropertiesType = CreateSchema & {
	readonly ServiceToken: string;
};

const secretManagerClient = new SecretsManagerClient({
	...aws_sdk_client_common_config,
});

export const handler: CdkCustomResourceHandler = async (event) => {
	const response: CdkCustomResourceResponse = {
		PhysicalResourceId: 'create-redshift-db-user-custom-resource',
		Data: {},
		Status: 'SUCCESS',
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
	if (requestType == 'Create' || requestType == 'Update') {
		await onCreate(event);
	}

	if (requestType == 'Delete') {
		await onDelete();
	}
}

async function onCreate(event: CdkCustomResourceEvent) {
	logger.info('onCreate()');

	const props = event.ResourceProperties as ResourcePropertiesType;

	const redshiftClient = getRedshiftClient(props.serverlessRedshiftProps!.dataAPIRoleArn);
	const credential = await createUserCredentialSecret(REDSHIFT_CREDENTIAL_SECRET, REDSHIFT_USERNAME);
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
				`GRANT ROLE sustainability_readers TO ${credential.username}`,
			],
			props.serverlessRedshiftProps, true,
		);
	} catch (err) {
		if (err instanceof Error) {
			logger.error('Error when creating database in serverless Redshift.', err);
		}
		throw err;
	}
}

async function onDelete() {
	try {
		await deleteUserCredentialSecret(REDSHIFT_CREDENTIAL_SECRET);
	} catch (error) {
		if (error instanceof ResourceNotFoundException) {
			logger.warn(`The parameter '${REDSHIFT_CREDENTIAL_SECRET}' already deleted.`);
		}
	}
}

async function createUserCredentialSecret(secretName: string, username: string): Promise<UserCredential> {
	const credential: UserCredential = {
		username,
		password: randomstring.generate(32),
	};

	const readParams: DescribeSecretCommandInput = {
		SecretId: secretName,
	};

	try {
		await secretManagerClient.send(new DescribeSecretCommand(readParams));

		const params: UpdateSecretCommandInput = {
			SecretId: secretName,
			SecretString: JSON.stringify(credential),
			Description: `SDF Demo Redshift credentials for demo data flow.`,
		};
		logger.info(`Updating the credential of user '${username}' of Redshift to parameter ${secretName}.`);

		await secretManagerClient.send(new UpdateSecretCommand(params));
	} catch (err: any) {
		if ((err as Error) instanceof ResourceNotFoundException) {
			await _createUserCredentialSecret(secretName, username, credential);
		} else {
			throw err;
		}
	}

	return credential;
}
async function _createUserCredentialSecret(secretName: string, username: string, credential: UserCredential): Promise<UserCredential> {
	const params: CreateSecretCommandInput = {
		Name: secretName,
		SecretString: JSON.stringify(credential),
		Description: `SDF Demo Redshift credentials for demo data flow.`,
	};
	logger.info(`Creating the credential of user '${username}' of Redshift to parameter ${secretName}.`);

	await secretManagerClient.send(new CreateSecretCommand(params));

	return credential;
}

async function deleteUserCredentialSecret(secretName: string) {
	const params: DeleteSecretCommandInput = {
		SecretId: secretName,
		ForceDeleteWithoutRecovery: true,
	};

	logger.info(`Deleting the credential ${secretName}.`);
	await secretManagerClient.send(new DeleteSecretCommand(params));
}
