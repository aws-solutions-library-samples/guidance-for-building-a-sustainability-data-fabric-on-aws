import { Stack, StackProps } from 'aws-cdk-lib';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type UseeioProperties = StackProps & {
	bucketName: string;
};

export class UseeioInfrastructureStack extends Stack {
	readonly vpcId: string;

	constructor(scope: Construct, id: string, props: UseeioProperties) {
		super(scope, id, props);

		const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);

		// Upload Useeio data and provenance to S3
		let dataPath = path.join(__dirname, '..','..','..','..','typescript','packages','products','useeio','resources');
		new BucketDeployment(this, 'UseeioSourceDeployment', {
			sources: [Source.asset(dataPath)],
			destinationBucket: bucket,
			destinationKeyPrefix: 'products/Useeio/',
		});

		// TODO: Create custom resource to call data asset module to register all of above datasets, set provenance metaform for sources, as well as setting glossary terms

	}
}
