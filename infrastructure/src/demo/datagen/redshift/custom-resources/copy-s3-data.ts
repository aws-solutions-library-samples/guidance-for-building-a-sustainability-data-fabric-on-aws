import { CdkCustomResourceEvent, CdkCustomResourceHandler, CdkCustomResourceResponse } from 'aws-lambda';
import { CopyS3Data } from '../models.js';
import { executeStatementsWithWait, getRedshiftClient } from '../redshift-data.js';
import { logger } from '../utils/logger.js';

type ResourcePropertiesType = CopyS3Data & {
	readonly ServiceToken: string;
};

export const handler: CdkCustomResourceHandler = async (event) => {
	const response: CdkCustomResourceResponse = {
		PhysicalResourceId: 'copy-s3-data-custom-resource',
		Data: {},
		Status: 'SUCCESS',
	};

	try {
		await _handler(event);
	} catch (e) {
		if (e instanceof Error) {
			logger.error('Error when copying S3 data to Redshift.', e);
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
	try {
		await executeStatementsWithWait(
			redshiftClient,
			[`COPY sustainability.golden_materials FROM 's3://${props.dataBucket}/materials.csv' CREDENTIALS 'aws_iam_role=${props.redshiftRoleForCopyFromS3}' csv`],
			props.serverlessRedshiftProps,
			true
		);
	} catch (err) {
		if (err instanceof Error) {
			logger.error('Error when copying S3 data to Redshift.', err);
		}
		throw err;
	}
}

async function onDelete() {
	// do nothing
}
