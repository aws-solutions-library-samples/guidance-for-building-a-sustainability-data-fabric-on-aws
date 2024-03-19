# US EPA GHG Emission Factors Hub

## Overview

Holds a local copy of the USEPA datasets (see `/resources`).

When run, extracts the individual tables from the souce datasets and stores in `/generatedResources`.

## Provenance

[Information](https://www.epa.gov/climateleadership/ghg-emission-factors-hub), including download details for source datasets.

Note: The provenance json files were manually constructed using information obtained from the [information](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) page.

## Deployment

Handled via the [USEPA stack](../../../../infrastructure/src/products/usepa/usepa.stack.ts).

