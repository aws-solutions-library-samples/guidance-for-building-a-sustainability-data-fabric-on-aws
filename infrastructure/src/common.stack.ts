import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export const bucketParameter = `/df/sdf/bucketName`;

export class CommonInfrastructureStack extends Stack {
	readonly bucketName: string;

	constructor(scope: Construct, id: string, props: StackProps) {
		super(scope, id, props);

		const accountId = Stack.of(this).account;
		const region = Stack.of(this).region;

		// bucket to store seeded data
		this.bucketName = `sdf-${accountId}-${region}-data`;
		const bucket = new Bucket(this, 'Bucket', {
			bucketName: this.bucketName,
			encryption: BucketEncryption.S3_MANAGED,
			intelligentTieringConfigurations: [
				{
					name: 'archive',
					archiveAccessTierTime: Duration.days(90),
					deepArchiveAccessTierTime: Duration.days(180),
				},
			],
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: true,
			versioned: false,
			serverAccessLogsPrefix: 'data',
			removalPolicy: RemovalPolicy.DESTROY,
		});

		new StringParameter(this, 'bucket', {
			parameterName: bucketParameter,
			stringValue: bucket.bucketName,
		});
	}
}
