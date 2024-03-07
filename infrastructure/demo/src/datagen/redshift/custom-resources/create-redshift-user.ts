import { CdkCustomResourceEvent, CdkCustomResourceHandler, CdkCustomResourceResponse } from 'aws-lambda';
import { CreateMappingRoleUser } from '../models.js';
import { logger } from './logger.js';
import { executeStatementsWithWait, getRedshiftClient } from './redshift-data.js';

type ResourcePropertiesType = CreateMappingRoleUser & {
	readonly ServiceToken: string;
};

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
		await onDelete(event);
	}
}

async function onCreate(event: CdkCustomResourceEvent) {
	logger.info('onCreate()');

	const props = event.ResourceProperties as ResourcePropertiesType;
	// 1. create database in Redshift
	const redshiftClient = getRedshiftClient(props.serverlessRedshiftProps!.dataAPIRoleArn);

	try {
		await executeStatementsWithWait(
			redshiftClient,
			[
				`CREATE USER "IAMR:${props.dataRoleName}" PASSWORD DISABLE CREATEDB`,
				'CREATE ROLE sdfdemo',
				'GRANT CREATE USER TO ROLE sdfdemo',
				`GRANT ROLE sdfdemo TO "IAMR:${props.dataRoleName}"`,
			],
			props.serverlessRedshiftProps
		);
	} catch (err) {
		if (err instanceof Error) {
			logger.error('Error when creating database in serverless Redshift.', err);
		}
		throw err;
	}
}
async function onDelete(_event: CdkCustomResourceEvent) {
	logger.info('onDelete()');
	logger.info('doNothing to keep the db user');
}
