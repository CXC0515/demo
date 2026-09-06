/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { runtimeConfig } from '../config/runtimeConfig';
import { verifyAppData } from '../services/operations/dataSnapshot';

const root = path.resolve(process.argv[2] ?? runtimeConfig.dataRoot);
const verification = await verifyAppData(root);
console.log(JSON.stringify({ event: 'app_data_verified', ...verification }));
if (verification.databases.some((database) => database.integrity !== 'ok') || verification.missingReferencedFiles.length) {
  process.exitCode = 1;
}
