import { IVpc, SubnetSelection } from 'aws-cdk-lib/aws-ec2';

export interface RedshiftServerlessWorkgroupProps {
	readonly vpc: IVpc;
	readonly subnetSelection: SubnetSelection;
	readonly securityGroupIds: string;
	readonly baseCapacity: number;
	readonly workgroupName: string;
	readonly databaseName: string;
	// readonly projectId: string;
}

interface RedshiftProps {
	readonly databaseName: string;
}

export interface RedshiftServerlessProps extends RedshiftProps {
	readonly workgroupName: string;
}

export interface BasicRedshiftServerlessProps extends RedshiftServerlessProps {
	readonly workgroupId?: string;
	readonly namespaceId?: string;
	readonly createdInStack: boolean;
}

export interface ExistingRedshiftServerlessProps extends BasicRedshiftServerlessProps {
	readonly dataAPIRoleArn: string;
}
export type ExistingRedshiftServerlessCustomProps = Omit<ExistingRedshiftServerlessProps, 'createdInStack'>;

export interface ProvisionedRedshiftProps extends RedshiftProps {
	readonly clusterIdentifier: string;
	readonly dbUser: string;
}

export interface CustomProperties {
	readonly serverlessRedshiftProps?: ExistingRedshiftServerlessCustomProps;
	readonly provisionedRedshiftProps?: ProvisionedRedshiftProps;
}

export type CreateMappingRoleUser = Omit<CustomProperties, 'provisionedRedshiftProps'> & {
	readonly dataRoleName: string;
};

export type NewNamespaceCustomProperties = RedshiftProps & {
	readonly adminRoleArn: string;
	readonly namespaceName: string;
};

export type MustacheParamBaseType = {
	[key: string]: string;
};

// TODO: add any specifics we need for our sql templates
export type MustacheParamType = {
	workgroup_default_admin_role_arn: string;
	database_name: string;
};

type SQLBasic = {
	readonly multipleLine?: 'true' | 'false';
};

export type SQLDef = SQLBasic & {
	readonly sqlFile: string;
};

export type SQLViewDef = SQLBasic & {
	readonly viewName: string;
};
