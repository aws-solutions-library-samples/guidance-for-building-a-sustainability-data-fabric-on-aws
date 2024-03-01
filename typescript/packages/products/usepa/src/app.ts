import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import path from "path";
import { Electricity } from "./tables/electricity.js";
import { GWP } from "./tables/gwp.js";
import { GWPForBlendedRefrigerants } from "./tables/gwpForBlendedRefrigerants.js";
import { MobileCombustionCH4andN2OforNonRoadVehicles } from "./tables/mobileCombustionCH4andN2OforNonRoadVehicles.js";
import { MobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles } from "./tables/mobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles.js";
import { MobileCombustionCH4andN2OforOnRoadGasolineVehicles } from "./tables/mobileCombustionCH4andN2OforOnRoadGasolineVehicles.js";
import { MobileCombustionCO2 } from "./tables/mobileCombustionCo2.js";
import { Scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution } from "./tables/scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution.js";
import { Scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts } from "./tables/scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts.js";
import { Scope3Category6BusinessTravelandCategory7EmployeeCommuting } from "./tables/scope3Category6BusinessTravelandCategory7EmployeeCommuting.js";
import { StationaryCombustion } from "./tables/stationaryCombustion.js";
import { SteamAndHeat } from "./tables/steamAndHeat.js";
import { V2023, V2024 } from "./versions.js";

export class App {
    private readonly s3:S3Client;

    public constructor() {
        // TODO inject region
        this.s3 = new S3Client();
    }

    public async run() {

        // get config related to the version we are uploading
        const versions = [
			new V2023(),
			new V2024(),
		];

		for (const v of versions) {

			// A1 - upload source spreadsheets
			const spreadsheetPath = path.resolve(__dirname, '..', 'resources', v.spreadsheetName);
			await this.s3.send(new PutObjectCommand({
				// TODO: inject bucket
				Bucket: '?',
				Key: 'sdf/seeds/usepa/' + path.parse(spreadsheetPath).base,
				Body: readFileSync(spreadsheetPath),
			}));

			// TODO: A2 - kick off datazone registration (including lineage and provenance)

			// B1 - extract the data from the spreadsheet
			const dataSetInfos = await Promise.all([
				(new StationaryCombustion(spreadsheetPath, v.stationaryCombustion, v.outputPrefix)).generate(),
				(new MobileCombustionCO2(spreadsheetPath, v.mobileCombustionCO2, v.outputPrefix)).generate(),
				(new MobileCombustionCH4andN2OforOnRoadGasolineVehicles(spreadsheetPath, v.mobileCombustionCH4andN2OforOnRoadGasolineVehicles, v.outputPrefix)).generate(),
				(new MobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles(spreadsheetPath, v.mobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles, v.outputPrefix)).generate(),
				(new MobileCombustionCH4andN2OforNonRoadVehicles(spreadsheetPath, v.mobileCombustionCH4andN2OforNonRoadVehicles, v.outputPrefix)).generate(),
				(new Electricity(spreadsheetPath, v.electricity, v.outputPrefix)).generate(),
				(new SteamAndHeat(spreadsheetPath, v.steamAndHeat, v.outputPrefix)).generate(),
				(new Scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution(spreadsheetPath, v.scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution, v.outputPrefix)).generate(),
				(new Scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts(spreadsheetPath, v.scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts, v.outputPrefix)).generate(),
				(new Scope3Category6BusinessTravelandCategory7EmployeeCommuting(spreadsheetPath, v.scope3Category6BusinessTravelandCategory7EmployeeCommuting, v.outputPrefix)).generate(),
				(new GWP(spreadsheetPath, v.gwp, v.outputPrefix)).generate(),
				(new GWPForBlendedRefrigerants(spreadsheetPath, v.gwpForBlendedRefrigerants, v.outputPrefix)).generate(),
			]);

			// B2 - Upload extracted CSV files to S3
			for (const dsi of dataSetInfos) {
				await this.s3.send(new PutObjectCommand({
					// TODO: inject bucket
					Bucket: '?',
					Key: 'sdf/seeds/usepa/' + path.parse(dsi.csvLocation).base,
					Body: readFileSync(path.resolve(__dirname, '..', 'resources', dsi.csvLocation)),
				}));
			}

			// TODO: B3 - kick off datazone registration (including lineage)
		}
    }

}
