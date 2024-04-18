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
	category: string;
	co2: number;
	ch4: number;
	n2o: number;
	year: number;
}

export class SteamAndHeat extends BaseUSEPA {
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
				category: d['__EMPTY'],
				co2: d['CO2 Factor \r\n(kg CO2 / mmBtu)'],
				ch4: d['CH4 Factor \r\n(g CH4 / mmBtu) '],
				n2o: d['N2O Factor \r\n(g N2O / mmBtu) '],
				year: this.year,
			});
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.year.toString(), 'steam-and-heat.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'category', title: 'Category' },
				{ id: 'co2', title: 'CO2 Factor (kg CO2 / mmBtu)' },
				{ id: 'ch4', title: 'CH4 Factor (g CH4 / mmBtu)' },
				{ id: 'n2o', title: 'N2O Factor (g N2O / mmBtu)' },
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
