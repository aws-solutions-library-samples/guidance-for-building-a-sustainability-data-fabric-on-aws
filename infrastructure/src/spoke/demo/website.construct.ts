import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CloudFrontAllowedMethods, CloudFrontWebDistribution, OriginAccessIdentity } from 'aws-cdk-lib/aws-cloudfront';
import { CanonicalUserPrincipal, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface WebsiteProperties {

}

export class WebsiteConstruct extends Construct {

	public constructor(scope: Construct, id: string, props: WebsiteProperties) {
		super(scope, id);
		const accountId = Stack.of(this).account;
		const region = Stack.of(this).region;

		const cloudfrontOAI = new OriginAccessIdentity(this, 'SdfDemoOriginAccessIdentity', {
			comment: `OAI for ${id}`
		});

		const namePrefix = 'sdf-demo';

		const websiteLogsBucket = new Bucket(this, 'SdfDemoWebsiteLogsBucket', {
			bucketName: `${namePrefix}-${accountId}-${region}-ui-logs`,
			removalPolicy: RemovalPolicy.DESTROY,
			accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
			autoDeleteObjects: true
		});

		websiteLogsBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:PutObject'],
				principals: [new ServicePrincipal('delivery.logs.amazonaws.com')],
				resources: [`${websiteLogsBucket.bucketArn}/*`],
				conditions: {
					StringEquals: {
						'AWS:SourceAccount': accountId
					},
					ArnLike: {
						'AWS:SourceArn': `arn:aws:cloudfront::${accountId}:distribution/*`
					}
				},
				sid: 'AllowCloudFrontLoggingAccess'
			})
		);

		const websiteBucket = new Bucket(this, 'SdfDemoWebsiteBucket', {
			bucketName: `${namePrefix}-${accountId}-${region}-ui`,
			publicReadAccess: false,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			removalPolicy: RemovalPolicy.DESTROY,
			autoDeleteObjects: true
		});

		websiteBucket.addToResourcePolicy(new PolicyStatement({
			actions: ['s3:GetObject'],
			resources: [websiteBucket.arnForObjects('*')],
			principals: [new CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
		}));

		websiteBucket.addToResourcePolicy(new PolicyStatement({
			actions: ['s3:ListBucket'],
			resources: [websiteBucket.bucketArn],
			principals: [new CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
		}));

		const distribution = new CloudFrontWebDistribution(this, 'SdfWebsiteDistribution', {
			defaultRootObject: 'index.html',
			loggingConfig: {
				bucket: websiteLogsBucket,
				prefix: 'website-access-logs/'
			},
			errorConfigurations: [
				{
					errorCode: 404,
					responsePagePath: '/index.html',
					responseCode: 200
				}
			],
			originConfigs: [
				{
					s3OriginSource: {
						s3BucketSource: websiteBucket,
						originAccessIdentity: cloudfrontOAI
					},
					behaviors: [{
						isDefaultBehavior: true,
						compress: true,
						allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS
					}]
				}
			]
		});


	}

}
