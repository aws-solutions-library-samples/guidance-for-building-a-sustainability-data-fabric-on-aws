import { UserAgent } from '@aws-sdk/types';

import { NodeHttpHandler } from '@smithy/node-http-handler';
import { HttpsProxyAgent } from 'hpagent';

const userAgent: UserAgent = [[<string>process.env.USER_AGENT_STRING ?? '']];

const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY || '';
const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY || '';

export const httpAgent = httpProxy ? new HttpsProxyAgent({ proxy: httpProxy }) : undefined;
export const httpsAgent = httpsProxy ? new HttpsProxyAgent({ proxy: httpsProxy }) : undefined;

export const aws_sdk_client_common_config = {
	maxAttempts: 3,
	requestHandler: new NodeHttpHandler({
		connectionTimeout: 5000,
		requestTimeout: 5000,
		httpAgent: httpAgent,
		httpsAgent: httpsAgent,
	}),
	customUserAgent: userAgent,
};
