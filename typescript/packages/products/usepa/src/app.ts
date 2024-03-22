import { S3Client } from "@aws-sdk/client-s3";
import path from "path";
import { fileURLToPath } from "url";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
			// extract the data from the spreadsheet and save to generatedResources
			const spreadsheetPath = path.resolve(__dirname, '..', 'resources', v.spreadsheetName);
			const dataSetInfos = await Promise.all([
				(new StationaryCombustion(spreadsheetPath, v.stationaryCombustion, v.year)).generate(),
				(new MobileCombustionCO2(spreadsheetPath, v.mobileCombustionCO2, v.year)).generate(),
				(new MobileCombustionCH4andN2OforOnRoadGasolineVehicles(spreadsheetPath, v.mobileCombustionCH4andN2OforOnRoadGasolineVehicles, v.year)).generate(),
				(new MobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles(spreadsheetPath, v.mobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles, v.year)).generate(),
				(new MobileCombustionCH4andN2OforNonRoadVehicles(spreadsheetPath, v.mobileCombustionCH4andN2OforNonRoadVehicles, v.year)).generate(),
				(new Electricity(spreadsheetPath, v.electricity, v.year)).generate(),
				(new SteamAndHeat(spreadsheetPath, v.steamAndHeat, v.year)).generate(),
				(new Scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution(spreadsheetPath, v.scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution, v.year)).generate(),
				(new Scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts(spreadsheetPath, v.scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts, v.year)).generate(),
				(new Scope3Category6BusinessTravelandCategory7EmployeeCommuting(spreadsheetPath, v.scope3Category6BusinessTravelandCategory7EmployeeCommuting, v.year)).generate(),
				(new GWP(spreadsheetPath, v.gwp, v.year)).generate(),
				(new GWPForBlendedRefrigerants(spreadsheetPath, v.gwpForBlendedRefrigerants, v.year)).generate(),
			]);

		}
    }

}


const app = new App();
await app.run();
