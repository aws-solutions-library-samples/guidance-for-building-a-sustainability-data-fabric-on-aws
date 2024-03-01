import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {readFileSync} from 'fs';

export class USEEIO {
    private s3: S3Client;

    public constructor() {
        //TODO: inject region
        this.s3 = new S3Client({ region: 'us-east-1' });
    }

    public async seed() {
        // 1 - Upload source CSV files to S3
        const files = [
            'SupplyChainGHGEmissionFactors_v1.2_NAICS_byGHG_USD2021.csv',
            'SupplyChainGHGEmissionFactors_v1.2_NAICS_CO2e_USD2021.csv'];

        for (const file of files) {
            await this.s3.send(new PutObjectCommand({
                Bucket: 'TODO',
                Key: 'sdf/seeds/useeio/' + file,
                Body: readFileSync('../resources/' + file)
            }));
        }

        // TODO: 2 - Register within the data fabric
        // register `provenance.json` as provenance metaform
        // add glossary terms from `provenance.keyword`.


    }
}