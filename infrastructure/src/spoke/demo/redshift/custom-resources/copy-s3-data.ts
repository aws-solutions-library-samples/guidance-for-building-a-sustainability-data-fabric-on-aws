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
		Status: 'SUCCESS'
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
			[`COPY sustainability.golden_materials FROM 's3://${props.dataBucket}/demo/datagen/materials/data.csv' CREDENTIALS 'aws_iam_role=${props.redshiftRoleForCopyFromS3}' csv`],
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
