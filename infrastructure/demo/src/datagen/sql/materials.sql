CREATE SCHEMA IF NOT EXISTS sustainability;

CREATE TABLE IF NOT EXISTS sustainability.golden_materials (
    material_code varchar(32),
    material_name varchar(256),
    supplier_code varchar(32),
    supplier_name varchar(256)
);

CREATE ROLE IF NOT EXISTS sustainability_reader;

GRANT SELECT ON {{database_name}}.sustainability.golden_materials to sustainability_reader;
