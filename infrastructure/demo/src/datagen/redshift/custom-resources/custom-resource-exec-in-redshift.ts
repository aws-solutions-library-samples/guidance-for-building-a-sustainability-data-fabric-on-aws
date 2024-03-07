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

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { aws_sdk_client_common_config } from './sdk-client-config';
import { logger } from './logger.js';
import { sleep } from './utils.js';
import { putStringToS3 } from './s3.js';

const sfnClient = new SFNClient({
  ...aws_sdk_client_common_config,
});

const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;		// TODO: figure out source
const S3_BUCKET = process.env.S3_BUCKET!;						// TODO: figure out source
const S3_PREFIX = process.env.S3_PREFIX!;						// TODO: figure out source

export const createSchemasInRedshiftAsync = async (sqlStatements: string[]) => {
    await executeSqlsByStateMachine(sqlStatements);
    await sleep(process.env.SUBMIT_SQL_INTERVAL_MS ? parseInt(process.env.SUBMIT_SQL_INTERVAL_MS) : 1000);
};


const executeSqlsByStateMachine = async (sqlStatements: string[]) => {

  const s3Paths = [];
  let index = 0;
  const timestamp = new Date().toISOString().replace(/[:.-]/g, '');

  for (const sqlStatement of sqlStatements) {
    const bucketName = S3_BUCKET;
    const fileName = `sdfdemo-${timestamp}/${index++}.sql`;
    const key = `${S3_PREFIX}tmp/sqls/${fileName}`;

    await putStringToS3(sqlStatement, bucketName, key);

    const s3Path = `s3://${bucketName}/${key}`;
    s3Paths.push(s3Path);
  }

  const params = {
    stateMachineArn: STATE_MACHINE_ARN,
    name: `sdfdemo-${timestamp}-${index}`,
    input: JSON.stringify({
      sqls: s3Paths,
    }),
  };
  logger.info('executeSqlsByStateMachine()', { params });
  try {
    const res = await sfnClient.send(new StartExecutionCommand(params));
    logger.info('executeSqlsByStateMachine()', { res });
    return res;
  } catch (err) {
    logger.error('Error happened when executing sqls in state machine.', { err });
    throw err;
  }
};
