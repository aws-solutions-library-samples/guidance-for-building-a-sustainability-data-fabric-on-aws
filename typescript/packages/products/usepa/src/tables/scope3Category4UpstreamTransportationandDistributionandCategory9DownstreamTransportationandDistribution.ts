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
	year: number;
}

export class Scope3Category4UpstreamTransportationandDistributionandCategory9DownstreamTransportationandDistribution extends BaseUSEPA {
	public constructor(sourceFile: string, cellReferences: CellReferences, year: number) {
		super(sourceFile, cellReferences, year);
	}

	private async saveAsCsv(): Promise<string> {
		// extract data
		this.worksheet['!ref'] = this.cellReferences.data;
		const data = xlsx.utils.sheet_to_json(this.worksheet);

		const items: Item[] = [];
		data.forEach((d) => {
			items.push({
				vehicleType: d['Vehicle Type'],
				co2: this.extractNumber(d['CO2 Factor \r\n(kg CO2 / unit)']),
				ch4: this.extractNumber(d['CH4 Factor \r\n(g CH4 / unit)']),
				n2o: this.extractNumber(d['N2O Factor \r\n(g N2O / unit)']),
				units: d['Units'],
				year: this.year,
			});
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.year.toString(), 'scope-3-category-4-upstream-transportation-and-distribution-and-category-9-downstream-transportation-and-distribution.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'vehicleType', title: 'Vehicle Type' },
				{ id: 'co2', title: 'CO2 Factor (kg CO2 / unit)' },
				{ id: 'ch4', title: 'CH4 Factor (g CH4 / unit)' },
				{ id: 'n2o', title: 'N2O Factor (g N2O / unit)' },
				{ id: 'units', title: 'Units' },
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
