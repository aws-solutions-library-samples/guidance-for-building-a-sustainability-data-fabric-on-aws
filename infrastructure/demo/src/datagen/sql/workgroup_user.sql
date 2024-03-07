CREATE USER "IAMR:{{workgroup_default_admin_role_arn}}" PASSWORD DISABLE CREATEDB;

CREATE ROLE sdfdemo_admin;

GRANT CREATE USER TO ROLE sdfdemo_admin;

GRANT ROLE sdfdemo_admin TO "IAMR:{{workgroup_default_admin_role_arn}}";
