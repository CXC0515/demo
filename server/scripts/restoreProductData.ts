/** @license SPDX-License-Identifier: Apache-2.0 */
import path from 'node:path';
import { restoreProductSnapshot } from '../services/operations/productSnapshot';
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: npm run restore:product -- <snapshot-directory> <new-target-directory>');
console.log(JSON.stringify({ event: 'product_snapshot_restored', ...await restoreProductSnapshot(path.resolve(process.argv[2]), path.resolve(process.argv[3])) }));
