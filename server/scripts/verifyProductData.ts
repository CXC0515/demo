/** @license SPDX-License-Identifier: Apache-2.0 */
import path from 'node:path';
import { verifyProductSnapshot } from '../services/operations/productSnapshot';
if (!process.argv[2]) throw new Error('Usage: npm run verify:product -- <snapshot-directory>');
const manifest = await verifyProductSnapshot(path.resolve(process.argv[2]));
console.log(JSON.stringify({ event: 'product_snapshot_verified', files: manifest.files.length, sqliteFiles: manifest.sqliteFiles }));
