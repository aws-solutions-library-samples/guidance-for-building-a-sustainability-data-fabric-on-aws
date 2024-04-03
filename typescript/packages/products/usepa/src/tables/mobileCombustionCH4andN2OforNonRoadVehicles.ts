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
	fuelType: string;
	ch4: number;
	n2o: number;
	year: number;
}

export class MobileCombustionCH4andN2OforNonRoadVehicles extends BaseUSEPA {
	public constructor(sourceFile: string, cellReferences: CellReferences, year: number) {
		super(sourceFile, cellReferences, year);
	}

	private async saveAsCsv(): Promise<string> {
		// extract data
		this.worksheet['!ref'] = this.cellReferences.data;
		const data = xlsx.utils.sheet_to_json(this.worksheet);

		let vehicleType = '?';
		const items: Item[] = [];
		data.forEach((d) => {
			const keys = Object.keys(d);

			if (keys.includes('Vehicle Type')) {
				vehicleType = (d['Vehicle Type'] as string).trim();

				// strip off suffixes)
				if (vehicleType === 'Agricultural EquipmentA') {
					vehicleType = 'Agricultural Equipment';
				} else if (vehicleType === 'Construction/Mining EquipmentB') {
					vehicleType = 'Construction/Mining Equipment';
				}
			}

			items.push({
				vehicleType,
				fuelType: d['Fuel Type'],
				ch4: this.extractNumber(d['CH4 Factor \r\n(g CH4 / gallon) ']),
				n2o: this.extractNumber(d['N2O Factor \r\n(g N2O / gallon) ']),
				year: this.year,
			});
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.year.toString(), 'mobile-combustion-ch4-and-n2O-for-non-road-vehicles.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'vehicleType', title: 'Vehicle Type' },
				{ id: 'fuelType', title: 'Fuel Type' },
				{ id: 'ch4', title: 'CH4 Factor (g CH4 / gallon)' },
				{ id: 'n2o', title: 'N2O Factor (g N2O / gallon)' },
				{ id: 'year', title: 'Year' },
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
