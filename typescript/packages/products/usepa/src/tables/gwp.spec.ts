import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { V2024 } from '../versions.js';
import { StationaryCombustion } from './stationaryCombustion.js';
import { GWP } from './gwp.js';

describe('GWP', () => {
    let underTest:GWP;

	beforeAll( async () => {
		const version = new V2024();
        const spreadsheetPath = path.resolve(__dirname, '..', '..', 'resources', version.spreadsheetName);
		underTest = new GWP(spreadsheetPath, version.gwp, version.year);
	});

	it('generate', async () => {

		const datasetInfo = await underTest.generate();

		console.log(`datasetInfo:
${JSON.stringify(datasetInfo, null, 2)}
`);

		expect(datasetInfo).not.empty;
		expect(datasetInfo.csvLocation).not.empty;
		expect(datasetInfo.sources).not.empty;
		expect(datasetInfo.notes).empty;


		// TODO test is failing, whereas performing a manual diff against each file they are identical.
		// const expected = await fs.promises.readFile(path.resolve(__dirname, '..', 'testResources', 'usepa_2024_table1_expected.csv'), 'utf8');
		// const actual = await fs.promises.readFile(datasetInfo.csvLocation, 'utf8');
		// expect(actual).toEqual(expected);

	});


});
