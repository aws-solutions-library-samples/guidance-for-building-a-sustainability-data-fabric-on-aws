import { IVpc, SubnetSelection } from 'aws-cdk-lib/aws-ec2';
import { IBucket } from 'aws-cdk-lib/aws-s3';

export interface RedshiftServerlessWorkgroupProps {
	readonly vpc: IVpc;
	readonly subnetSelection: SubnetSelection;
	readonly securityGroupIds: string;
	readonly baseCapacity: number;
	readonly workgroupName: string;
	readonly databaseName: string;
	// readonly projectId: string;
	readonly dataBucket: string;
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

// export interface ProvisionedRedshiftProps extends RedshiftProps {
// 	readonly clusterIdentifier: string;
// 	readonly dbUser: string;
// }

export interface CustomProperties {
	readonly serverlessRedshiftProps?: ExistingRedshiftServerlessCustomProps;
}

export type CreateSchema = Omit<CustomProperties, 'provisionedRedshiftProps'> & {
	readonly dataRoleName: string;
};

export type CopyS3Data = Omit<CustomProperties, 'provisionedRedshiftProps'> & {
	readonly redshiftRoleForCopyFromS3: string;
	readonly dataBucket: string;
}

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
	password: string;
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

export interface UserCredential {
	readonly username: string;
	readonly password: string;
}

//   export interface RedshiftOdsTables {
// 	readonly event: string;
// 	readonly event_parameter: string;
// 	readonly user: string;
// 	readonly item: string;
//   }
export type CreateDatabaseAndSchemas = CustomProperties & {
	// readonly projectId: string;
	// readonly appIds: string;
	// readonly odsTableNames: RedshiftOdsTables;
	readonly databaseName: string;
	readonly dataAPIRole: string;
	readonly redshiftUserParameter: string;
	// readonly redshiftBIUsernamePrefix: string;
	// readonly reportingViewsDef: SQLViewDef[];
	readonly schemaDefs: SQLDef[];
	// readonly lastModifiedTime: number;
};

interface BucketInfo {
	readonly s3Bucket: IBucket;
	readonly prefix: string;
}

export type WorkflowBucketInfo = BucketInfo;

export type AssociateIAMRoleToRedshift = CustomProperties & {
	readonly roleArn: string;
	readonly timeoutInSeconds: number;
};
