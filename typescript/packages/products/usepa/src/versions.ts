export interface VersionStrategy {
    spreadsheetName: string;
	outputPrefix: string;

    stationaryCombustion:CellReferences;
	mobileCombustionCO2:CellReferences;
	mobileCombustionCH4andN2OforOnRoadGasolineVehicles:CellReferences;
	mobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles:CellReferences;
	mobileCombustionCH4andN2OforNonRoadVehicles:CellReferences;
	electricity:CellReferences;
	steamAndHeat:CellReferences;
	scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution:CellReferences;
	scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts : CellReferences;
	scope3Category6BusinessTravelandCategory7EmployeeCommuting: CellReferences;
	gwp:CellReferences,
	gwpForBlendedRefrigerants: CellReferences;
}

export interface CellReferences {
    data: string;
    sources?: string;
    notes?: string;
}

abstract class BaseVersion implements VersionStrategy {
	outputPrefix: string;
    spreadsheetName: string;
    stationaryCombustion:CellReferences;
	mobileCombustionCO2:CellReferences;
	mobileCombustionCH4andN2OforOnRoadGasolineVehicles:CellReferences;
	mobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles:CellReferences;
	mobileCombustionCH4andN2OforNonRoadVehicles:CellReferences;
	electricity:CellReferences;
	steamAndHeat:CellReferences;
	scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution:CellReferences;
	scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts : CellReferences;
	scope3Category6BusinessTravelandCategory7EmployeeCommuting: CellReferences;
	gwp:CellReferences;
	gwpForBlendedRefrigerants: CellReferences;
}

export class V2023 extends BaseVersion {
	public constructor() {
		super();
		this.spreadsheetName = 'ghg-emission-factors-hub-2023.xlsx';
		this.outputPrefix = '2023';

		this.stationaryCombustion = {
			data: 'C14:J89',
			sources: 'C91:C92',
			notes: 'C94:C95',
		};
		this.mobileCombustionCO2 = {
			data: 'C99:E109',
			sources: 'C111:C112',
			notes: 'C114:C115',
		};
		this.mobileCombustionCH4andN2OforOnRoadGasolineVehicles = {
			data: 'C119:F228',
			sources: 'C229',
			notes: 'C230',
		};
		this.mobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles = {
			data: 'C234:G268',
			sources: 'C269:C270',
			notes: 'C271',
		};
		this.mobileCombustionCH4andN2OforNonRoadVehicles = {
			data: 'C275:F315',
			sources: 'C316:C317',
			notes: 'C318',
		};
		this.electricity = {
			data: 'C323:J352',
			sources: 'C353:C354',
			notes: 'C356:C358',
		};
		this.steamAndHeat = {
			data: 'C393:F394',
			/// Note: Intentionally no sources to import
			notes: 'C396:C397',
		};
		this.scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution = {
			data: 'C404:G411',
			sources: 'C412',
			notes: 'C413',
		};
		this.scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts = {
			data: 'C418:I478',
			sources: 'C479',
			notes: 'C480',
		};
		this.scope3Category6BusinessTravelandCategory7EmployeeCommuting = {
			data: 'C504:G496',
			sources: 'C497',
			notes: 'C498',
		};

		this.gwp = {
			data: 'C513:D536',
			sources: 'C537',
			/// Note: Intentionally no notes to import
		};
		this.gwpForBlendedRefrigerants = {
			data: 'C541:E577',
			sources: 'C578',
			/// Note: Intentionally no notes to import
		};
	}
}

export class V2024 extends BaseVersion {
	public constructor() {
		super();
		this.spreadsheetName = 'ghg-emission-factors-hub-2024.xlsx';
		this.outputPrefix = '2024';

		this.stationaryCombustion = {
			data: 'C15:J90',
			sources: 'C92:C93',
			notes: 'C95:C98',
		};
		this.mobileCombustionCO2 = {
			data: 'C102:E112',
			sources: 'C114:C115',
			notes: 'C117:C119',
		};
		this.mobileCombustionCH4andN2OforOnRoadGasolineVehicles = {
			data: 'C123:F235',
			sources: 'C236',
			notes: 'C237',
		};
		this.mobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles = {
			data: 'C241:G275',
			sources: 'C276:C277',
			notes: 'C278',
		};
		this.mobileCombustionCH4andN2OforNonRoadVehicles = {
			data: 'C282:F322',
			sources: 'C323:C324',
			notes: 'C325',
		};
		this.electricity = {
			data: 'C330:J359',
			sources: 'C360:C361',
			notes: 'C363:C365',
		};
		this.steamAndHeat = {
			data: 'C400:F401',
			/// Note: Intentionally no sources to import
			notes: 'C402:C403',
		};
		this.scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution = {
			data: 'C411:G418',
			sources: 'C419',
			notes: 'C420',
		};
		this.scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts = {
			data: 'C425:I486',
			sources: 'C488',
			notes: 'C489',
		};
		this.scope3Category6BusinessTravelandCategory7EmployeeCommuting = {
			data: 'C493:G505',
			sources: 'C506',
			notes: 'C507',
		};
		this.gwp = {
			data: 'C513:E545',
			sources: 'C546',
			/// Note: Intentionally no notes to import
		};
		this.gwpForBlendedRefrigerants = {
			data: 'C550:E580',
			sources: 'C581',
			/// Note: Intentionally no notes to import
		};
	}
}
