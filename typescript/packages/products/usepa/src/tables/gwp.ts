import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import xlsx from 'xlsx';
import { BaseUSEPA } from './baseUsepa.js';
import type { Dataset } from '../models.js';
import type { CellReferences } from '../versions.js';

interface Item {
    name: string;
	formula?: string;
    gwp100: number;
}

export class GWP extends BaseUSEPA {

    public constructor(sourceFile:string, cellReferences: CellReferences, outputPrefix:string) {
        super(sourceFile, cellReferences, outputPrefix);
    }

    private async saveAsCsv() : Promise<string> {
        // extract data
        this.worksheet['!ref'] = this.cellReferences.data;
        const data = xlsx.utils.sheet_to_json(this.worksheet);

        const items:Item[]=[];
        data.forEach(d=> {
			items.push({
				name: d['Industrial Designation or \r\nCommon Name '],
				formula: d['Chemical Formula '],
				gwp100: d['100-Year GWP'],
			});
		});

        // output as csv
        const csvPath = path.resolve(__dirname, '..', '..', 'generatedResources', this.outputPrefix, 'gwp.csv');
        const writer = createObjectCsvWriter({
            path: csvPath,
            header: [
				{ id: 'name', title: 'Industrial Designation or Common Name' },
				{ id: 'formula', title: 'Chemical Formula' },
              { id: 'gwp100', title: '100-Year GWP' },
            ],
          });

          await this.writeCsvWithByteOrderMark(writer, items, csvPath);

          return csvPath;

    }

    public async generate() : Promise<Dataset> {
        // 1 - Extract data
        const csvLocation = await this.saveAsCsv();
        const sources = this.extractAsStringArray(this.cellReferences.sources);
        const notes = this.extractAsStringArray(this.cellReferences.notes);

        return {csvLocation, sources, notes};
    }
}
