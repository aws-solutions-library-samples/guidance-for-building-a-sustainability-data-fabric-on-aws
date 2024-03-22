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
	hhv: number;
	hhvUnit: string;
	co2Energy: number;
	co2EnergyUnit: string;
	ch4Energy: number;
	ch4EnergyUnit: string;
	n2oEnergy: number;
	n2oEnergyUnit: string;
	co2: number;
	co2Unit: string;
	ch4: number;
	ch4Unit: string;
	n2o: number;
	n2oUnit: string;
	year: number;
}

export class StationaryCombustion extends BaseUSEPA {
	public constructor(sourceFile: string, cellReferences: CellReferences, year: number) {
		super(sourceFile, cellReferences, year);
	}

	private async saveAsCsv(): Promise<string> {
		// extract table 1 info
		this.worksheet['!ref'] = this.cellReferences.data;
		const table1_data = xlsx.utils.sheet_to_json(this.worksheet);

		let category, hhvUnit, co2EnergyUnit, ch4EnergyUnit, n2oEnergyUnit, co2Unit, ch4Unit, n2oUnit;
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
						co2Energy: d['CO2 Factor'],
						co2EnergyUnit: d['CO2 Factor'] ? co2EnergyUnit : undefined,
						ch4Energy: d['CH4 Factor'],
						ch4EnergyUnit: d['CH4 Factor'] ? ch4EnergyUnit : undefined,
						n2oEnergy: d['N2O Factor'],
						n2oEnergyUnit: d['N2O Factor'] ? n2oEnergyUnit : undefined,
						co2: d['CO2 Factor_1'],
						co2Unit: d['CO2 Factor_1'] ? co2Unit : undefined,
						ch4: d['CH4 Factor_1'],
						ch4Unit: d['CH4 Factor_1'] ? ch4Unit : undefined,
						n2o: d['N2O Factor_1'],
						n2oUnit: d['N2O Factor_1'] ? n2oUnit : undefined,
						year: this.year,
					});
				}
			} else {
				hhvUnit = d['Energy Content (HHV)'];
				co2EnergyUnit = d['CO2 Factor'];
				ch4EnergyUnit = d['CH4 Factor)'];
				n2oEnergyUnit = d['N2O Factor'];
				co2Unit = d['CO2 Factor_1'];
				ch4Unit = d['CH4 Factor_1'];
				n2oUnit = d['N2O Factor_1'];
			}
		});

		// output as csv
		const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.year.toString(), 'stationary-combustion.csv');
		const writer = createObjectCsvWriter({
			path: csvPath,
			header: [
				{ id: 'category', title: 'Fuel Category' },
				{ id: 'fuelType', title: 'Fuel Type' },
				{ id: 'hhv', title: 'Heat Content (HHV)' },
				{ id: 'hhvUnit', title: 'Heat Content (HHV) Unit' },
				{ id: 'co2Energy', title: 'CO2 Factor Energy' },
				{ id: 'co2EnergyUnit', title: 'CO2 Factor Energy Unit' },
				{ id: 'ch4Energy', title: 'CH4 Factor Energy' },
				{ id: 'ch4EnergyUnit', title: 'CH4 Factor Energy Unit' },
				{ id: 'n2oEnergy', title: 'N2O Factor Energy' },
				{ id: 'n2oEnergyUnit', title: 'N2O Factor Energy Unit' },
				{ id: 'co2', title: 'CO2 Factor' },
				{ id: 'co2Unit', title: 'CO2 Factor Unit' },
				{ id: 'ch4', title: 'CH4 Factor' },
				{ id: 'ch4Unit', title: 'CH4 Factor Unit' },
				{ id: 'n2o', title: 'N2O Factor' },
				{ id: 'n2oUnit', title: 'N2O Factor Unit' },
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
