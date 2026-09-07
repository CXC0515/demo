/** @license SPDX-License-Identifier: Apache-2.0 */
import 'dotenv/config';
import path from 'node:path';
import { runtimeConfig } from '../config/runtimeConfig';
import { createProductSnapshot } from '../services/operations/productSnapshot';
const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const source = path.resolve(process.argv[2] ?? runtimeConfig.dataRoot);
const destination = path.resolve(process.argv[3] ?? path.join(runtimeConfig.backupDirectory, `product-${timestamp}`));
const manifest = await createProductSnapshot(source, destination);
console.log(JSON.stringify({ event: 'product_snapshot_created', destination, files: manifest.files.length, sqliteFiles: manifest.sqliteFiles }));
