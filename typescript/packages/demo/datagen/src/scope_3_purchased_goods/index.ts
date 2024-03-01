import * as fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Material } from './materials.js';
import { Invoice } from './invoices.js';
import { Supplier } from './suppliers.js';

const argv = yargs(hideBin(process.argv))
  .option('outputDirectory', {
    alias: 'o',
    description: 'the output directory  where the results will be saved in',
    type: 'string',
    demandOption: true,
  })
  .option('suppliersCount', {
    description: 'Count of suppliers to generate.',
    type: 'number',
    default: 10,
  })
  .option('materialsCount', {
    description: 'Count of materials to generate.',
    type: 'number',
    default: 20,
  })
  .option('invoicesCount', {
    description: 'Count of invoices to generate.',
    type: 'number',
    default: 30,
  })
  .help()
  .alias('help', 'h').argv;

const {materialsCount, suppliersCount, invoicesCount, outputDirectory} = argv

// create suppliers
const suppliers:Supplier[] = [];
for (let i=0; i<suppliersCount; i++) {
  suppliers.push(new Supplier())
}

// create materials
const materials:Material[] = [];
for (let i=0; i<materialsCount; i++) {
    materials.push(new Material(suppliers))
}

// create invoices
const invoices:Invoice[] = [];
for (let i=0; i<invoicesCount; i++) {
    invoices.push(new Invoice(materials))
}

// Create directory if it doesn't exist
if (!fs.existsSync(outputDirectory)) {
  fs.mkdirSync(outputDirectory, { recursive: true });
}

// write out materials to file
let writableStream = fs.createWriteStream(`${outputDirectory}/materials.csv`);
writableStream.write(Material.CSV_HEADER + '\r\n');
materials.forEach(l=> writableStream.write(l.asCsv() + '\r\n'));
writableStream.end();
console.log(`Finished creating materials.`)

// write out invoices to file
writableStream = fs.createWriteStream(`${outputDirectory}/invoices.csv`);
writableStream.write(Invoice.CSV_HEADER);
invoices.forEach(i=> writableStream.write(i.asCsv()));
writableStream.end();
console.log(`Finished creating invoices.`)



