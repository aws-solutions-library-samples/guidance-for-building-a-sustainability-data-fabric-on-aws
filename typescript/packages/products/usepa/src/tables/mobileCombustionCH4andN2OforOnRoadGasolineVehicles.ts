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
	modelYear: number;
	ch4: number;
	n2o: number;
	year: number;
}

export class MobileCombustionCH4andN2OforOnRoadGasolineVehicles extends BaseUSEPA {
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
		const items: Item[] = [];
		data.forEach((d) => {
			const keys = Object.keys(d);
			if (keys.includes('Vehicle Type')) {
				vehicleType = d['Vehicle Type'];
			}

			let modelYear = keys.includes('Model Year') ? d['Model Year'] : d['Year'];
			if (typeof modelYear === 'number' && !isNaN(modelYear)) {
				// a single entry so add as is
				items.push({
					vehicleType,
					modelYear,
					ch4: this.extractNumber(d[ch4ColumnName]),
					n2o: this.extractNumber(d[n2oColumnName]),
					year: this.year,
				});
			} else {
				// modelYear is a range, therefore add individual entries to make it easier on the downstream consumers of this data
				modelYear = (modelYear as string).trim();
				let fromYear: number, toYear: number;
				if (modelYear[0] === '≤') {
					fromYear = 1973;
					toYear = Number.parseInt(modelYear.substring(1));
				} else if (modelYear.length === 9) {
					fromYear = Number.parseInt(modelYear.split('-')[0]);
					toYear = Number.parseInt(modelYear.split('-')[1]);
				}

				for (let year = fromYear; year <= toYear; year++) {
					items.push({
						vehicleType,
						modelYear: year,
						ch4: this.extractNumber(d[ch4ColumnName]),
						n2o: this.extractNumber(d[n2oColumnName]),
						year: this.year,
					});
				}
			}
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.year.toString(), 'mobile-combustion-ch4-and-n2O-for-on-road-gasoline-vehicles.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'vehicleType', title: 'Vehicle Type' },
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
