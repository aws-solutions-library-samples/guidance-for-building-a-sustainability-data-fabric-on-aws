import { BatchExecuteStatementCommand, DescribeStatementCommand, ExecuteStatementCommand, RedshiftDataClient, StatusString } from '@aws-sdk/client-redshift-data';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { ExistingRedshiftServerlessCustomProps, ProvisionedRedshiftProps, RedshiftServerlessProps } from '../models.js';
import { logger } from './logger.js';
import { aws_sdk_client_common_config } from './sdk-client-config.js';
import { sleep } from './utils.js';

export function getRedshiftClient(roleArn: string) {
	return new RedshiftDataClient({
		...aws_sdk_client_common_config,
		requestHandler: new NodeHttpHandler({
			connectionTimeout: 5000,
			requestTimeout: 50000,
		}),
		credentials: fromTemporaryCredentials({
			// Required. Options passed to STS AssumeRole operation.
			params: {
				// Required. ARN of role to assume.
				RoleArn: roleArn,
				// Optional. An identifier for the assumed role session. If skipped, it generates a random
				// session name with prefix of 'aws-sdk-js-'.
				RoleSessionName: 'redshift-data-api',
				// Optional. The duration, in seconds, of the role session.
				DurationSeconds: 900,
			},
		}),
	});
}

export const executeStatements = async (
	client: RedshiftDataClient,
	sqlStatements: string[],
	serverlessRedshiftProps?: RedshiftServerlessProps,
	provisionedRedshiftProps?: ProvisionedRedshiftProps,
	database?: string,
	logSQL: boolean = true
) => {
	if (serverlessRedshiftProps) {
		logger.info(`Execute SQL statement in ${serverlessRedshiftProps.workgroupName}.${serverlessRedshiftProps.databaseName}`);
	} else if (provisionedRedshiftProps) {
		logger.info(`Execute SQL statement in ${provisionedRedshiftProps.clusterIdentifier}.${provisionedRedshiftProps.databaseName}`);
	}

	const logSqlStatements = sqlStatements.map((s) => {
		if (s.toLocaleLowerCase().includes('password')) {
			return s.replace(new RegExp(/password.*/i), 'password *****');
		}
		return s;
	});
	logger.info('executeStatements', { logSqlStatements });

	if (sqlStatements.length == 0) {
		logger.warn('No SQL statement to execute.');
		return;
	}
	let queryId: string;
	if (sqlStatements.length == 1) {
		const params = new ExecuteStatementCommand({
			Sql: sqlStatements[0],
			WorkgroupName: serverlessRedshiftProps?.workgroupName,
			ClusterIdentifier: provisionedRedshiftProps?.clusterIdentifier,
			DbUser: provisionedRedshiftProps?.dbUser,
			Database: database ?? serverlessRedshiftProps?.databaseName ?? provisionedRedshiftProps?.databaseName,
			WithEvent: true,
		});
		const execResponse = await client.send(params);
		queryId = execResponse.Id!;
	} else {
		const params = new BatchExecuteStatementCommand({
			Sqls: sqlStatements,
			WorkgroupName: serverlessRedshiftProps?.workgroupName,
			ClusterIdentifier: provisionedRedshiftProps?.clusterIdentifier,
			DbUser: provisionedRedshiftProps?.dbUser,
			Database: database ?? serverlessRedshiftProps?.databaseName ?? provisionedRedshiftProps?.databaseName,
			WithEvent: true,
		});
		const execResponse = await client.send(params);
		queryId = execResponse.Id!;
	}
	logger.info(`Got query_id:${queryId} after executing command ${logSQL ? sqlStatements.join(';') : '***'} in redshift.`);

	return queryId;
};

export interface WaitProps {
	checkIntervalMilliseconds: number;
	maxCheckCount: number;
	raiseTimeoutError: boolean;
}

export const executeStatementsWithWait = async (
	client: RedshiftDataClient,
	sqlStatements: string[],
	serverlessRedshiftProps?: ExistingRedshiftServerlessCustomProps,
	provisionedRedshiftProps?: ProvisionedRedshiftProps,
	database?: string,
	logSQL: boolean = true,
	waitProps: WaitProps = {
		checkIntervalMilliseconds: 1000,
		maxCheckCount: 900,
		raiseTimeoutError: true,
	}
) => {
	logger.info('executeStatementsWithWait', { waitProps, sqlStatements_1: sqlStatements[0].substring(0, 64) });

	const queryId = await executeStatements(client, sqlStatements, serverlessRedshiftProps, provisionedRedshiftProps, database, logSQL);

	const checkParams = new DescribeStatementCommand({
		Id: queryId,
	});
	let response = await client.send(checkParams);
	logger.info(`Got statement query '${queryId}' with status: ${response.Status} after submitting it`);
	let count = 0;
	while (response.Status != StatusString.FINISHED && response.Status != StatusString.FAILED && count < waitProps.maxCheckCount) {
		await sleep(waitProps.checkIntervalMilliseconds);
		count++;
		response = await client.send(checkParams);
		logger.info(`Got statement query '${queryId}' with status: ${response.Status} in ${count * waitProps.checkIntervalMilliseconds} Milliseconds`);
	}
	if (response.Status == StatusString.FAILED) {
		logger.error(`Got statement query '${queryId}' with status: ${response.Status} in ${count * waitProps.checkIntervalMilliseconds} Milliseconds`, { response });
		throw new Error(`Statement query '${queryId}' with status ${response.Status}, error: ${response.Error}, queryString: ${response.QueryString}`);
	} else if (count == waitProps.maxCheckCount) {
		logger.error('Timeout: wait status timeout: ' + response.Status, { response });
		if (waitProps.raiseTimeoutError) {
			throw new Error(`Timeout error, timeout seconds: ${(count * waitProps.checkIntervalMilliseconds) / 1000}, queryString: ${response.QueryString}`);
		}
	}
	return queryId;
};
