import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { CamlClient } from './camlClient.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CamlClient', () => {
    let camlClient:CamlClient;

	beforeEach(async () => {
		camlClient = new CamlClient();
	});

	it('should map naics codes', async () => {
		const csvFilePath = path.resolve(__dirname, '..', '..', 'generatedResources', 'materials.csv');

        const parser = fs.createReadStream(csvFilePath)
            .pipe(parse({columns:true}));

        const results:unknown[][] = [];
        results.push(['material_name',
            'title_1', 'naicsCode_1', 'beaCode_1', 'confidence_1', 'co2ePerDollar_1',
            'title_2', 'naicsCode_2', 'beaCode_2', 'confidence_2', 'co2ePerDollar_2',
            'title_3', 'naicsCode_3', 'beaCode_3', 'confidence_3', 'co2ePerDollar_3',
            'title_4', 'naicsCode_4', 'beaCode_4', 'confidence_4', 'co2ePerDollar_4',
            'title_5', 'naicsCode_5', 'beaCode_5', 'confidence_5', 'co2ePerDollar_5'
        ]);

        for await (const row of parser) {
            const result:unknown[] = [];
            const productName = row.material_name;
            result.push(productName);

            const matches = await camlClient.matchNAICS(productName);
            expect(matches).toBeDefined();
            for (let r of matches) {
                result.push(...[r.title, r.naicsCode, r.beaCode, r.confidence, r.co2ePerDollar]);
            }
            results.push(result)
        }

        const output = stringify(results);
		const outputFilePath = path.resolve(__dirname, '..', '..', 'generatedResources', 'materials_matched.csv');
        const writableStream = fs.createWriteStream(outputFilePath);
        writableStream.write(output);
        writableStream.end();

        console.log(output);

	}, {timeout: 60000});
});
