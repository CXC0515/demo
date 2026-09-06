/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { runtimeConfig } from '../config/runtimeConfig';
import { createAppDataSnapshot } from '../services/operations/dataSnapshot';

const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const sourceRoot = path.resolve(process.argv[2] ?? runtimeConfig.dataRoot);
const destinationRoot = path.resolve(process.argv[3] ?? path.join(runtimeConfig.backupDirectory, `app-data-${timestamp}`));
const manifest = await createAppDataSnapshot(sourceRoot, destinationRoot);

console.log(JSON.stringify({
  event: 'app_data_backup_created',
  destinationRoot,
  files: manifest.files.length,
  bytes: manifest.files.reduce((total, file) => total + file.size, 0),
  databases: manifest.verification.databases,
}));
