import xlsx, { WorkBook, WorkSheet } from 'xlsx';
import type { CellReferences } from '../versions.js';
import type { CsvWriter } from 'csv-writer/src/lib/csv-writer.js';
import type { ObjectMap } from 'csv-writer/src/lib/lang/object.js';
import * as fs from 'fs';

export abstract class BaseUSEPA {

    protected worksheet: WorkSheet;
    protected workbook: WorkBook;
    protected cellReferences: CellReferences;
	protected year:number;

    public constructor(sourceFile:string, cellReferences: CellReferences, year:number) {
        this.workbook = xlsx.readFile(sourceFile);
        this.worksheet = this.workbook.Sheets['Emission Factors Hub'];
        this.cellReferences = cellReferences;
		this.year = year;
    }

    protected extractAsStringArray(worksheetRef: string) : string[] {
        this.worksheet['!ref'] = worksheetRef;
        const raw = xlsx.utils.sheet_to_json(this.worksheet, {header:1});
        const flattened = raw.reduce((accumulator:string, value:string) => accumulator.concat(value), []) as string[];
        return flattened;
    }

    protected async writeCsvWithByteOrderMark(writer: CsvWriter<ObjectMap<any>>, items:unknown[], csvPath:string) {
        await writer.writeRecords(items).then(() => {
            // hack to add utf-8 byte order mark
            const fileContents = fs.readFileSync(csvPath);
            fs.writeFileSync(csvPath, '\ufeff' + fileContents);
          });
    }

}
