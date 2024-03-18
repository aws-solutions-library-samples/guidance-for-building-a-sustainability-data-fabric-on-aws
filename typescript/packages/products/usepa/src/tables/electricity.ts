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
	eGRIDSubregionAcronym: string;
	eGRIDSubregionName: string;
	totalOutputCo2Factor: number;
	totalOutputCh4Factor: number;
	totalOutputN2oFactor: number;
	nonBaseloadCo2Factor: number;
	nonBaseloadCh4Factor: number;
	nonBaseloadN2oFactor: number;
}

export class Electricity extends BaseUSEPA {
	public constructor(sourceFile: string, cellReferences: CellReferences, outputPrefix: string) {
		super(sourceFile, cellReferences, outputPrefix);
	}

	private async saveAsCsv(): Promise<string> {
		// extract data
		this.worksheet['!ref'] = this.cellReferences.data;
		const data = xlsx.utils.sheet_to_json(this.worksheet);

		const items: Item[] = [];
		data.forEach((d) => {
			const keys = Object.keys(d);

			if (keys.includes('eGRID Subregion Acronym')) {
				items.push({
					eGRIDSubregionAcronym: d['eGRID Subregion Acronym'],
					eGRIDSubregionName: d['eGRID Subregion Name'],
					totalOutputCo2Factor: d['CO2 Factor'],
					totalOutputCh4Factor: d['CH4 Factor'],
					totalOutputN2oFactor: d['N2O Factor'],
					nonBaseloadCo2Factor: d['CO2 Factor_1'],
					nonBaseloadCh4Factor: d['CH2 Factor_1'],
					nonBaseloadN2oFactor: d['N2O Factor_1'],
				});
			}
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.outputPrefix, 'electricity.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'eGRIDSubregionAcronym', title: 'eGRID Subregion Acronym' },
				{ id: 'eGRIDSubregionName', title: 'eGRID Subregion Name' },
				{ id: 'totalOutputCo2Factor', title: 'Total Output CO2 Factor (lb CO2 / MWh)' },
				{ id: 'totalOutputCh4Factor', title: 'Total Output CH4 Factor (lb CH4 / MWh)' },
				{ id: 'totalOutputN2oFactor', title: 'Total Output N2O Factor (lb N2O / MWh)' },
				{ id: 'nonBaseloadCo2Factor', title: 'Non-Baseload CO2 Factor (lb CO2 / MWh)' },
				{ id: 'nonBaseloadCh4Factor', title: 'Non-Baseload CH4 Factor (lb CH4 / MWh)' },
				{ id: 'nonBaseloadN2oFactor', title: 'Non-Baseload N2O Factor (lb CN2OO2 / MWh)' },
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
