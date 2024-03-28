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
	material: string;
	recycled: number;
	landfilled: number;
	combusted: number;
	composted: number;
	anaerobicallyDigestedDry: number;
	anaerobicallyDigestedWet: number;
	year: number;
}

export class Scope3Category5WasteGeneratedinOperationsandCategory12EndofLifeTreatmentofSoldProducts extends BaseUSEPA {
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
				material: d['Material'],
				recycled: this.extractNumber(d['RecycledA']),
				landfilled: this.extractNumber(d['LandfilledB']),
				combusted: this.extractNumber(d['CombustedC']),
				composted: this.extractNumber(d['CompostedD']),
				anaerobicallyDigestedDry: this.extractNumber(d['Anaerobically Digested (Dry Digestate with Curing)']),
				anaerobicallyDigestedWet: this.extractNumber(d['Anaerobically Digested (Wet  Digestate with Curing)']),
				year: this.year,
			});
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.year.toString(), 'scope-3-category-5-waste-generated-in-operations-and-category-12-end-of-life-treatment-of-sold-products.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'material', title: 'Material' },
				{ id: 'recycled', title: 'Recycled (Metric Tons CO2e / Short Ton Material)' },
				{ id: 'landfilled', title: 'Landfilled (Metric Tons CO2e / Short Ton Material)' },
				{ id: 'combusted', title: 'Combusted (Metric Tons CO2e / Short Ton Material)' },
				{ id: 'composted', title: 'Composted (Metric Tons CO2e / Short Ton Material)' },
				{ id: 'anaerobicallyDigestedDry', title: 'Anaerobically Digested (Dry Digestate with Curing (Metric Tons CO2e / Short Ton Material))' },
				{ id: 'anaerobicallyDigestedWet', title: 'Anaerobically Digested (Wet  Digestate with Curing) (Metric Tons CO2e / Short Ton Material)' },
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
