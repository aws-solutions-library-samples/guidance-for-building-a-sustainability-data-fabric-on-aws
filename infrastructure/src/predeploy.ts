
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { getDfAwsEnvironment } from './utils/util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caller environment
const callerEnvironment = await getDfAwsEnvironment();

fs.writeFileSync(`${__dirname}/predeploy.json`, JSON.stringify({ callerEnvironment }));
