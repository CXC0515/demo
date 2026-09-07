#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const envPath = path.join(projectRoot, '.env');
const temporaryPath = `${envPath}.tmp`;
const existing = await readFile(envPath, 'utf8');
const existingMode = (await stat(envPath)).mode;
const entries = new Map();
for (const line of existing.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match && !entries.has(match[1])) entries.set(match[1], match[2]);
}

const currentSecret = entries.get('AUTH_SECRET')?.replace(/^['"]|['"]$/g, '') ?? '';
const generatedSecret = currentSecret.length < 32;
const values = new Map([
  ['NODE_ENV', 'production'],
  ['APP_URL', 'https://td.unreached.cn'],
  ['API_HOST', '127.0.0.1'],
  ['API_PORT', '4317'],
  ['APP_DATA_ROOT', '/Users/cxc/Projects/DEMO/var-product'],
  ['APP_BACKUP_ROOT', '/Users/cxc/Projects/DEMO/var-product/backups'],
  ['APP_DIST_DIR', '/Users/cxc/Projects/DEMO/dist'],
  ['SHUTDOWN_TIMEOUT_MS', '15000'],
  ['AUTH_SECRET', generatedSecret ? randomBytes(48).toString('base64url') : currentSecret],
]);

const seen = new Set();
const lines = existing.split(/\r?\n/).flatMap(line => {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (!match || !values.has(match[1])) return [line];
  if (seen.has(match[1])) return [];
  seen.add(match[1]);
  return [`${match[1]}=${values.get(match[1])}`];
});
for (const [key, value] of values) {
  if (!seen.has(key)) lines.push(`${key}=${value}`);
}
await writeFile(temporaryPath, `${lines.filter((line, index, all) => line || index < all.length - 1).join('\n')}\n`, {
  mode: existingMode,
  flag: 'wx',
});
await rename(temporaryPath, envPath);
console.log(JSON.stringify({ event: 'production_environment_configured', keys: [...values.keys()], generatedAuthSecret: generatedSecret }));
