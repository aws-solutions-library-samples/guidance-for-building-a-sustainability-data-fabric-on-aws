# Sample lineage

> Note: to alleviate confusion, _data profiling_ referred to _data quality metrics_, and _data quality profiling_ referred to _data quality assertions_.

## 1 - US EPA Emission Factors

- Registration of 2 3P spreadsheets as source data assets
  - `1.1.1` to `1.1.2` - registration of spreadsheet as data asset
- Registration of csv's as derived data assets (12 of)
  - `1.2.1` to `1.2.2` - registration of csv as data asset, plus `sourceCodeLocation` and `columnLineage`
  - `1.2.3` to `1.2.4` - data quality metrics job liked to `parent`, and adds `dataQualityMetrics` to input. Intentionally no output.

## 3 - USEEIO Emission Factors

- Registration of 2 3P csv's as source data assets
  - Follows same flow as `1.1.1` to `1.1.2` to register source
  - Then follows same flow `1.2.3` to `1.2.4` to gather data quality metrics

## 4 - SDF Demo Data Generation

- Registration of materials (redshift) data as source data asset
  - Similar to flow `1.1.1` to `1.1.2` but with redshift as the source
  - Then follows same flow `1.2.3` to `1.2.4` to gather data quality metrics
- Registration of invoices csv as source data asset
  - Follows same flow as `1.1.1` to `1.1.2` to register source
  - Then follows same flow `1.2.3` to `1.2.4` to gather data quality metrics

## 6 - Publishing matched material NAICS to DF

- Registration of materials_naics csv as a derived data asset
  - Similar to `1.2.1` to `1.2.2`, but with multiple inputs, to register derived data asset
  - Then follows same flow `1.2.3` to `1.2.4` to gather data quality metrics

## 7 - Invoice data quality assertions

- Evaluate data quality assertions:
  - `7.1.1` to `7.1.2`

## 8 - Cleaned invoice data

> Note: this is the only one in the demo using transform capabilities of data asset module!

- Transformation and registration of invoice_cleaned.csv
  - `8.1.1` to `8.2.2` for transform and registration
  - Then follows same flow `1.2.3` to `1.2.4` to gather data quality metrics

## 9 - Cleaned invoice data quality assertions

- Evaluate data quality assertions:
  - Follows same flows as `7.1.1` to `7.1.2`

## 10 - Scope 3 purchased goods & services
