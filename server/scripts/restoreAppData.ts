/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { restoreAppDataSnapshot } from '../services/operations/dataSnapshot';

const snapshotArgument = process.argv[2];
const targetArgument = process.argv[3];
if (!snapshotArgument || !targetArgument) {
  throw new Error('Usage: npm run restore:data -- <snapshot-directory> <new-target-directory>');
}
const report = await restoreAppDataSnapshot(path.resolve(snapshotArgument), path.resolve(targetArgument));
console.log(JSON.stringify({ event: 'app_data_restored', ...report }));
