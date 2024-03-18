# SDF Demo

## Overview

This document describes the overall data flow, as well each data products responsibility, to generate KPI’s for scope 3 purchased goods & services.

## Overall Flow

![overall flow](docs/sdf-demo%20flows.png)

## Data Products

### 1 - US EPA Emission Factors

**Package name:** @df-sustainability/usepa.
**Package location:** df-sustainability/typescript/packages/products/usepa.

**Inputs:**

* External GHG Emission Factor Hub spreadsheets (both 2023 and 2024 versions (pre-downloaded to `/resources`)

**Outcomes:**

* Original GHG Emission Factor Hub spreadsheets (both 2023 and 2024 versions):
    * Spreadsheets uploaded to S3
    * Spreadsheets registered (or updated) within DataZone
    * Lineage representing external source
* Individual tables (12 per version) extracted from GHG Emission Factor Hub spreadsheets (both 2023 and 2024 versions):
    * Extracted data uploaded to S3 (csv)
    * Extracted data registered (or updated) within DataZone
    * Lineage representing datasets derived from original spreadsheets


### 2 - Import US EPA Emission Factors into SIF

**Package name:** @df-sustainability/usepaSifImport.
**Package location:** df-sustainability/typescript/packages/products/usepaSifImport.

**Inputs:**

* 12 US EPA emission factor tables from [1 - US EPA Emission Factors](#1---us-epa-emission-factors) into SIF.

**Outcomes:**

* Seeding of 12 impact pipelines to import the 12 US EPA emission factor tables into SIF.


### 3 - USEEIO Emission Factors

**Package name:** @df-sustainability/useeio.
**Package location:** df-sustainability/typescript/packages/products/useeio.


**Inputs:**

* External _SupplyChainGHGEmissionFactors_v1.2_NAICS_CO2e_USD2021.csv_ and _SupplyChainGHGEmissionFactors_v1.2_NAICS_byGHG_USD2021.csv_ datasets (pre-downloaded to `/resources`)

**Outcomes:**

* Original _SupplyChainGHGEmissionFactors_v1.2_NAICS_CO2e_USD2021.csv_ and _SupplyChainGHGEmissionFactors_v1.2_NAICS_byGHG_USD2021.csv_ datasets:
    * Assets uploaded to S3
    * Assets registered (or updated) within DataZone
    * Lineage representing source dataset


### 4 - SDF Demo Data Generation

**Package name:** @df-sustainability/datagen.
**Package location:** df-sustainability/typescript/packages/demo/datagen.


**Inputs:**

* None - all faked data

**Outcomes:**

* Materials:
    * Demo data generated, and loaded into Redshift serverless
    * Asset registered (or updated) within DataZone
    * Lineage representing source dataset
* Invoices:
    * Demo data generated, and uploaded into S3 (csv)
    * Asset registered (or updated) within DataZone
    * Lineage representing source dataset


### 5 - Mapping materials to EEIO emission factors

**Package name:** @df-sustainability/materialsNaicsMatching.
**Package location:** df-sustainability/typescript/packages/demo/materialsNaicsMatching.


**Inputs:**

* Imported material data from Redshift serverless (registered as part of 4 - SDF Demo Data Generation).

**Outcomes:**

* Seeding of a SIF data pipeline to match materials to NAICS codes using CaML flow.
* Seeding of a SIF impact pipeline to store chosen match of material to NAICS code.

### 6 - Publishing matched material NAICS to DF

**Package name:** @df-sustainability/matchedNaics.
**Package location:** df-sustainability/typescript/packages/demo/matchedNaics.


**Inputs:**

* Material NAICS match details from SIF (5 - Mapping materials to EEIO emission factors).

**Outcomes:**

* Exports matched material NAICS codes.
* Uploads matched material NAICS codes to S3 (csv).
* Asset registered (or updated) within DataZone.
* Lineage representing derived dataset.

### 7 - Invoice data quality assertions

**Package name:** @df-sustainability/rawInvoiceDataQuality.
**Package location:** df-sustainability/typescript/packages/demo/rawInvoiceDataQuality.


**Inputs:**

* Invoice data created as part of 4 - SDF Demo Data Generation.

**Outcomes:**

* Data quality profile created for invoice data, stored as new metaform.
* Data quality profile stored in lineage as inputs.dataQualityMetrics facet.

### 8 - Cleaned invoice data

**Package name:** @df-sustainability/invoiceCleaning.
**Package location:** df-sustainability/typescript/packages/demo/invoiceCleaning.


**Inputs:**

* Invoice data created as part of 4 - SDF Demo Data Generation.

**Outcomes:**

* A Databrew recipe job performs cleanup of data.
* Uploads cleaned invoice data to S3 (csv).
* Asset registered (or updated) within DataZone.
* Lineage representing derived dataset.



### 9 - Cleaned invoice data quality assertions

**Package name:** @df-sustainability/cleanInvoiceDataQuality.
**Package location:** df-sustainability/typescript/packages/demo/cleanInvoiceDataQuality.


**Inputs:**

* Invoice data created as part of 8 - Cleaned invoice data.

**Outcomes:**

* Same data quality profile as executed for 7 - Invoice data quality assertions created for cleaned invoice data, stored as new metaform.
* Data quality profile stored in lineage as inputs.dataQualityMetrics facet.



### 10 - Scope 3 purchased goods & services

**Package name:** @df-sustainability/scope3PurchasedGoods.
**Package location:** df-sustainability/typescript/packages/demo/scope3PurchasedGoods.


**Inputs:**

* US EPA emission factors (imported via 2 - Import US EPA Emission Factors into SIF).
* Material NAICS impacts (imported via 5 - Mapping materials to EEIO emission factors).
* Clean invoice data (imported via 8 - Cleaned invoice data).

**Outcomes:**

* Seeding of a SIF activity pipeline, along with custom calculations, to calculate emissions based from invoice data.
* Latest processed activities for the affected time period exported to S3.
* Latest affected metrics for the affected time period exported to S3.
* Assets registered (or updated) within DataZone.
* Lineage representing derived dataset.

