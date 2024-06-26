/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import esbuild from 'esbuild';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const dist = join(process.cwd(), 'dist');

if (!existsSync(dist)) {
    mkdirSync(dist);
}

// cjs output bundle
esbuild
    .build({
        outdir: 'dist/cjs',
        bundle: true,
        sourcemap: true,
        minify: false,
        format: 'cjs',
        outExtension: {
            '.js': '.cjs',
        },
        platform: 'node',
        target: ['node20'],
    })
    .catch(() => process.exit(1));

// // an entry file for esm at the root of the bundle
writeFileSync(join(dist, 'index.cjs'), "module.exports = require('./cjs/index.cjs');");
