import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import type { Dataset } from '../models.js';
import type { CellReferences } from '../versions.js';
import { BaseUSEPA } from './baseUsepa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Table1Item {
	category: string;
	fuelType: string;
	hhv?: number;
	hhvUnit?: string;
	co2Mmbtu?: number;
	ch4Mmbtu?: number;
	n2oMmbtu?: number;
	co2Ton?: number;
	ch4Ton?: number;
	n2oTon?: number;
}

export class StationaryCombustion extends BaseUSEPA {
	public constructor(sourceFile: string, cellReferences: CellReferences, outputPrefix: string) {
		super(sourceFile, cellReferences, outputPrefix);
	}

	private async saveAsCsv(): Promise<string> {
		// extract table 1 info
		this.worksheet['!ref'] = this.cellReferences.data;
		const table1_data = xlsx.utils.sheet_to_json(this.worksheet);

		let category = '?';
		let hhvUnit = '?';
		const items: Table1Item[] = [];
		table1_data.forEach((d) => {
			const keys = Object.keys(d);
			const keyCount = keys.length;

			if (keys.includes('Fuel Type')) {
				if (keyCount === 1) {
					category = (d['Fuel Type'] as string).replace(/(\r\n|\n|\r)/gm, '');
				} else {
					items.push({
						category,
						fuelType: d['Fuel Type'],
						hhv: d['Heat Content (HHV)'],
						hhvUnit: d['Heat Content (HHV)'] ? hhvUnit : undefined,
						co2Mmbtu: d['CO2 Factor'],
						ch4Mmbtu: d['CH4 Factor'],
						n2oMmbtu: d['N2O Factor'],
						co2Ton: d['CO2 Factor_1'],
						ch4Ton: d['CH4 Factor_1'],
						n2oTon: d['N2O Factor_1'],
					});
				}
			} else {
				hhvUnit = d['Heat Content (HHV)'];
			}
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.outputPrefix, 'stationary-combustion.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'category', title: 'Fuel Category' },
				{ id: 'fuelType', title: 'Fuel Type' },
				{ id: 'hhv', title: 'Heat Content (HHV)' },
				{ id: 'hhvUnit', title: 'Heat Content (HHV) Unit' },
				{ id: 'co2Mmbtu', title: 'CO2 Factor (kg CO2 per mmBtu)' },
				{ id: 'ch4Mmbtu', title: 'CH4 Factor (g CO2 per mmBtu)' },
				{ id: 'n2oMmbtu', title: 'N2O Factor (g CO2 per mmBtu)' },
				{ id: 'co2Ton', title: 'CO2 Factor (kg CO2 per short ton)' },
				{ id: 'ch4Ton', title: 'CH4 Factor (g CO2 per short ton)' },
				{ id: 'n2oTon', title: 'N2O Factor (g CO2 per short ton)' },
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
