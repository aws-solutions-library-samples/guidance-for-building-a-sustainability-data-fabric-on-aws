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
	modelYear?: number;
	ch4: number;
	n2o: number;
	year: number;
}

export class MobileCombustionCH4andN2OforOnRoadDieselandAlternativeFuelVehicles extends BaseUSEPA {
	public constructor(sourceFile: string, cellReferences: CellReferences, year: number) {
		super(sourceFile, cellReferences, year);
	}

	private async saveAsCsv(): Promise<string> {
		// extract data
		this.worksheet['!ref'] = this.cellReferences.data;
		const data = xlsx.utils.sheet_to_json(this.worksheet);

		const ch4ColumnName = `CH4 Factor \r\n(g CH4 / vehicle-mile)`;
		const n2oColumnName = `N2O Factor \r\n(g N2O / vehicle-mile)`;

		let vehicleType = '?';
		let fuelType = '?';
		const items: Item[] = [];
		data.forEach((d) => {
			const keys = Object.keys(d);

			if (keys.includes('Vehicle Type')) {
				vehicleType = d['Vehicle Type'];
			}
			if (keys.includes('Fuel Type')) {
				fuelType = d['Fuel Type'];
			}

			let modelYear = d['Model Year'] as string;
			if (modelYear) {
				// modelYear is a range, therefore add individual entries to make it easier on the downstream consumers of this data
				modelYear = (modelYear as string).trim();
				const fromYear = Number.parseInt(modelYear.split('-')[0]);
				const toYear = Number.parseInt(modelYear.split('-')[1]);

				for (let year = fromYear; year <= toYear; year++) {
					items.push({
						vehicleType,
						fuelType,
						modelYear: year,
						ch4: d[ch4ColumnName],
						n2o: d[n2oColumnName],
						year: this.year,
					});
				}
			} else {
				items.push({
					vehicleType,
					fuelType,
					ch4: d[ch4ColumnName],
					n2o: d[n2oColumnName],
					year: this.year,
				});
			}
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.year.toString(), 'mobile-combustion-ch4-and-n2o-for-on-road-diesel-and-alternative-fuel-vehicles.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'vehicleType', title: 'Vehicle Type' },
				{ id: 'fuelType', title: 'Fuel Type' },
				{ id: 'modelYear', title: 'Model Year' },
				{ id: 'ch4', title: 'CH4 Factor (g CH4 / vehicle-mile)' },
				{ id: 'n2o', title: 'N2O Factor (g N2O / vehicle-mile)' },
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
