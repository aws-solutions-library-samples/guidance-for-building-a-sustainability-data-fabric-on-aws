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
	name: string;
	formula?: string;
	gwp100: number;
	year: number;
}

export class GWP extends BaseUSEPA {
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
				name: d['Industrial Designation or \r\nCommon Name '],
				formula: d['Chemical Formula '],
				gwp100: d['100-Year GWP'],
				year: this.year,
			});
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.year.toString(), 'gwp.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'name', title: 'Industrial Designation or Common Name' },
				{ id: 'formula', title: 'Chemical Formula' },
				{ id: 'gwp100', title: '100-Year GWP' },
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
