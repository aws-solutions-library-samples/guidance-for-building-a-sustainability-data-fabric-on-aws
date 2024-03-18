import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import type { Dataset } from '../models.js';
import type { CellReferences } from '../versions.js';
import { BaseUSEPA } from './baseUsepa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Item {
	vehicleType: string;
	co2: number;
	ch4: number;
	n2o: number;
	units: string;
}

export class Scope3Category6BusinessTravelandCategory7EmployeeCommuting extends BaseUSEPA {
	public constructor(sourceFile: string, cellReferences: CellReferences, outputPrefix: string) {
		super(sourceFile, cellReferences, outputPrefix);
	}

	private async saveAsCsv(): Promise<string> {
		// extract data
		this.worksheet['!ref'] = this.cellReferences.data;
		const data = xlsx.utils.sheet_to_json(this.worksheet);

		const items: Item[] = [];
		data.forEach((d) => {
			// cleanup vehicle type
			let vehicleType = d['Vehicle Type'] as string;
			vehicleType = (() => {
				switch (vehicleType) {
					case 'Passenger Car A':
					case 'Light-Duty Truck B':
					case 'Intercity Rail - Northeast Corridor C':
					case 'Intercity Rail - Other Routes C':
					case 'Intercity Rail - National Average C':
					case 'Commuter Rail D':
					case 'Transit Rail (i.e. Subway, Tram) E':
						return vehicleType.substring(0, vehicleType.length - 2);

					default:
						return vehicleType;
				}
			})();

			items.push({
				vehicleType,
				co2: d['CO2 Factor \r\n(kg CO2 / unit)'],
				ch4: d['CH4 Factor \r\n(g CH4 / unit)'],
				n2o: d['N2O Factor \r\n(g N2O / unit)'],
				units: d['Units'],
			});
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.outputPrefix, 'scope3-category-6-business-travel-and-category-7-employee-commuting.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'vehicleType', title: 'Vehicle Type' },
				{ id: 'co2', title: 'CO2 Factor (kg CO2 / unit)' },
				{ id: 'ch4', title: 'CH4 Factor (g CH4 / unit)' },
				{ id: 'n2o', title: 'N2O Factor (g N2O / unit)' },
				{ id: 'units', title: 'Units' },
			],
		});

		await this.writeCsvWithByteOrderMark(writer, items, csvPath);

		return csvPath;
	}

	public async generate(): Promise<Dataset> {
		// 1 - Extract data
		const csvLocation = await this.saveAsCsv();
		const sources = this.extractAsStringArray(this.cellReferences.sources);
		const notes = this.extractAsStringArray(this.cellReferences.notes);

		return { csvLocation, sources, notes };
	}
}
