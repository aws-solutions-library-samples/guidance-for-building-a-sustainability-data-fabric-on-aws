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
	fuelType: string;
	kgCo2PerUnit: number;
	unit: string;
	year: number;
}

export class MobileCombustionCO2 extends BaseUSEPA {
	public constructor(sourceFile: string, cellReferences: CellReferences, year: number) {
		super(sourceFile, cellReferences, year);
	}

	private async saveAsCsv(): Promise<string> {
		// extract data
		this.worksheet['!ref'] = this.cellReferences.data;
		const gwp_data = xlsx.utils.sheet_to_json(this.worksheet);

		const items: Item[] = [];
		gwp_data.forEach((d) => {
			items.push({
				fuelType: d['Fuel Type'],
				kgCo2PerUnit: d['kg CO2 per unit'],
				unit: d['Unit'],
				year: this.year,
			});
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.year.toString(), 'mobile-combustion-co2.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'fuelType', title: 'Fuel Type' },
				{ id: 'kgCo2PerUnit', title: 'kg CO2 per unit' },
				{ id: 'unit', title: 'Unit' },
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
