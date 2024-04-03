import { AccountPrincipal, ManagedPolicy, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export interface CredentialProps {
	spokeAccountId: string;
	dfSustainabilityRoleName: string;
}

export class CredentialConstruct extends Construct {
	public constructor(scope: Construct, id: string, props: CredentialProps) {
		super(scope, id);

		const dataZoneReadOnlyRole = new Role(this, 'DataZoneReadOnlyRole', {
			assumedBy: new AccountPrincipal(props.spokeAccountId),
			roleName: props.dfSustainabilityRoleName,
			description: 'This role will be assumed by the trigger pipeline task lambda to query asset listing id'
		});

		dataZoneReadOnlyRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonDataZoneFullUserAccess'));

		NagSuppressions.addResourceSuppressions(dataZoneReadOnlyRole, [
			{
				id: 'AwsSolutions-IAM4',
				reason: 'This policy is needed to search asset listings.',
				appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/AmazonDataZoneFullUserAccess']
			}
		], true);
	}
}
