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
	ashrae: string;
	gwp100: number;
	blendComposition: string;
}

export class GWPForBlendedRefrigerants extends BaseUSEPA {
	public constructor(sourceFile: string, cellReferences: CellReferences, outputPrefix: string) {
		super(sourceFile, cellReferences, outputPrefix);
	}

	private async saveAsCsv(): Promise<string> {
		// extract data
		this.worksheet['!ref'] = this.cellReferences.data;
		const data = xlsx.utils.sheet_to_json(this.worksheet);

		const items: Item[] = [];
		data.forEach((d) => {
			items.push({
				ashrae: d['ASHRAE #'],
				gwp100: d['100-year GWP'],
				blendComposition: d['Blend Composition'],
			});
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.outputPrefix, 'gwp-for-blended-refrigerants.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'ashrae', title: 'ASHRAE #' },
				{ id: 'gwp100', title: '100-year GWP' },
				{ id: 'blendComposition', title: 'Blend Composition' },
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
