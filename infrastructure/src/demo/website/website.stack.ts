import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs';
import { Website } from './website.construct.js';
import { NagSuppressions } from 'cdk-nag';


export interface WebsiteProperties {
}

export class WebsiteStack extends Stack {

    constructor(scope: Construct, id: string, props: WebsiteProperties & StackProps) {
        super(scope, id, props);

        new Website(this, 'Website', {})


        NagSuppressions.addResourceSuppressionsByPath(this, [
            '/WebsiteStack/Website/SdfDemoWebsiteBucket/Resource',
            '/WebsiteStack/Website/SdfDemoWebsiteBucket/Policy/Resource'
        ],
            [
                {
                    id: 'AwsSolutions-S1',
                    reason: 'This is a demo application and does not require Access Logs'

                },
                {
                    id: 'AwsSolutions-S10',
                    reason: 'This is a demo application and does not require SSL'

                }],
            true);

        NagSuppressions.addResourceSuppressionsByPath(this, [
            '/WebsiteStack/Website/SdfWebsiteDistribution/CFDistribution'
        ],
            [
                {
                    id: 'AwsSolutions-CFR3',
                    reason: 'This is a demo application and does not require Access Logs'

                },
                {
                    id: 'AwsSolutions-CFR4',
                    reason: 'This is a demo application and we need to support TLSV1 for now'

                }],
            true);
    };

}