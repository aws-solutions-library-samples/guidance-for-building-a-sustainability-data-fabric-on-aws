# Guidance for Sustainability Data Fabric on AWS

The Guidance for Sustainability Data Fabric on AWS is an opinionated sustainability lens built on top of the Guidance for Data Fabric on AWS.

## Table of Contents
1. [Overview](#overview)
    - [Cost](#cost)
2. [Prerequisites](#prerequisites)
    - [Operating System](#operating-system)
3. [Deployment Steps](#deployment-steps)
4. [Deployment Validation](#deployment-validation)
5. [Running the Guidance](#running-the-guidance)
6. [Next Steps](#next-steps)
7. [Cleanup](#cleanup)

## Overview

### Cost

To be added in April.

## Prerequisites

### Operating System

These deployment instructions are intended for use on MacOS. Deployment using a different operating system may require additional steps.

### Third-Party tools

1. [Rush](https://rushjs.io/)
2. [Node](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs) 20

### AWS Account Requirements

1. Deploy the Guidance for Data Fabric sample code.
2. Deploy the Guidance for Sustainability Insights Framework sample code. See steps [here](https://gitlab.aws.dev/wwso-cross-industry-prototyping/sif/sif-core/-/blob/main/docs/deployment/cdk_walkthrough.md).
    1. Clone GitLab repo `git clone git@ssh.gitlab.aws.dev:wwso-cross-industry-prototyping/sif/sif-core.git`
    2. Change into directory `cd sif-core`
    3. Switch to feature branch `git switch feature/sif_publish_openlineage`
    4. Install dependencies `rush update --bypass-policy`
    5. Build `rush build`
    6. Change into platform infrastructure directory `cd infrastructure/platform`
    7. [Export credentials and the AWS region to the environment](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html)
    8. Deploy platform (can choose appropriate environment) `npm run cdk — deploy -c environment=dev -c clusterDeletionProtection=false -c includeCaml=true --all --require-approval never --concurrency=5`
    9. Change into tenant infrastructure directory `cd ../tenant`
    10. Deploy tenant (can choose appropriate tenantId) `npm run cdk -- deploy -c tenantId=<tenantId> -c environment=<SIF_ENVIRONMENT> -c administratorEmail=<ADMIN_EMAIL> -c enableDeleteResource=true -c deleteBucket=true -c includeCaml=true --all --require-approval never --concurrency=10`
    11. Change admin password `cd ../../typescript/packages/integrationTests && ``npm run generate:token -- <tenantId> <SIF_ENVIRONMENT> <ADMIN_EMAIL> 'temporary password' 'new password'`

### AWS CDK Bootstrap

The hub and spoke accounts must be [bootstrapped](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html) for the [AWS Cloud Development Kit](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html). The spoke account must be bootstrapped to trust the hub account.

1. `cdk bootstrap <HUB_ACCOUNT_ID>/<REGION> --profile <HUB_PROFILE>`
2. `cdk bootstrap <SPOKE_ACCOUNT_ID>/<REGION> --trust <HUB_ACCOUNT_ID> --cloudformation-execution-policies=arn:aws:iam::aws:policy/AdministratorAccess --profile <SPOKE_PROFILE>`

### Service limits

1. Go to **Service Quotas** in the AWS Console. Navigate to Glue DataBrew and request a service quota increase to 50 for **Concurrent jobs per AWS account** (Quota code L-935D4120).

## Deployment Steps

1. `git clone git@github.com:aws-solutions-library-samples/guidance-for-sustainability-data-fabric-on-aws.git`
2. `cd guidance-for-sustainability-data-fabric-on-aws`
3. Install dependencies `rush update --bypass-policy`
4. Build `rush build`
5. `cd infrastructure`
6. [Export credentials for the hub account and the AWS region to the environment](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html)
7. Deploy `npm run cdk -- deploy -c hubAccountId=<HUB_ACCOUNT_ID> -c spokeAccountId=<SPOKE_ACCOUNT_ID> -c domainId=<DATAZONE_DOMAIN_ID> -c domainName=<DATAZONE_DOMAIN_NAME> -c projectId=<DATAZONE_PROJECT_ID> -c athenaEnvironmentId=<DATAZONE_DATA_LAKE_ENV_ID> -c redshiftEnvironmentId=<DATAZONE_DATA_WAREHOUSE_ENV_ID> -c roleArn=<SERVICE_ROLE_ARN> -c environment=<SIF_ENV> -c tenantId=<SIF_TENANT_ID> -c sifAdminEmailAddress=<SIF_ADMIN_EMAIL> -c sifAdminUserId=<IAM_IDENTITY_CENTER_USERNAME> —all —require-approval never —concurrency=10`

## Deployment Validation

1. Check that the following CloudFormation stacks have been successfully created:
    1. Hub account
        1. `sdf-common-hub`
        2. `sdf-products-hub`
        3. `sdf-demo-spoke`
    2. Spoke account
        1. `sdf-common-spoke`
        2. `sdf-workflow-spoke`
        3. `sdf-products-spoke`
        4. `sdf-demo-spoke`
2. Check that the Step Functions have completed successfully.
    1. Go to the AWS Console in the hub account and look at the `df-data-asset` State Machine in AWS Step Functions. You should see about 30 successful executions.
    2. Go to the AWS Console in the spoke account and look at the `df-spoke-data-asset` State Machine in AWS Step Functions. You should see about 30 successful executions.

## Running the Guidance

Everything should run automatically after deployment completes. You can now navigate to the DataZone UI and explore the assets that have been created. If you don’t see all assets in the DataZone catalog, try rerunning the deployment steps.

## Next Steps

1. See the next steps of the Guidance for Data Fabric on AWS to learn more about general next steps.

## Cleanup

1. Go to the AWS Console and delete all CloudFormation stacks prefixed by `sdf` in the hub and spoke accounts.
2. Clean up SIF as described in the [documentation](https://github.com/aws-solutions-library-samples/guidance-for-aws-sustainability-insights-framework/blob/main/docs/deployment/cli_walkthrough.md#tear-down).

## Notices

*Customers are responsible for making their own independent assessment of the information in this Guidance. This Guidance: (a) is for informational purposes only, (b) represents AWS current product offerings and practices, which are subject to change without notice, and (c) does not create any commitments or assurances from AWS and its affiliates, suppliers or licensors. AWS products or services are provided “as is” without warranties, representations, or conditions of any kind, whether express or implied. AWS responsibilities and liabilities to its customers are controlled by AWS agreements, and this Guidance is not part of, nor does it modify, any agreement between AWS and its customers.*
