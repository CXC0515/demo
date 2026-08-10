/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { closeRosterDatabase, getRosterDatabase, getRosterDatabasePath } from '../database/rosterDatabase';

const backupDirectory = path.resolve(process.env.ROSTER_BACKUP_DIR ?? 'var/backups/roster');
mkdirSync(backupDirectory, { recursive: true });

const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const destination = path.resolve(process.argv[2] ?? path.join(backupDirectory, `roster-${timestamp}.sqlite`));
if (destination === getRosterDatabasePath()) throw new Error('Backup destination must differ from the live database path.');

await getRosterDatabase().backup(destination);
closeRosterDatabase();

const backup = new Database(destination, { readonly: true });
const integrity = backup.pragma('integrity_check', { simple: true });
const classes = backup.prepare('SELECT COUNT(*) AS count FROM classes').get() as { count: number };
const students = backup.prepare('SELECT COUNT(*) AS count FROM students').get() as { count: number };
backup.close();
for (const sidecarPath of [`${destination}-wal`, `${destination}-shm`]) {
  if (existsSync(sidecarPath)) unlinkSync(sidecarPath);
}
if (integrity !== 'ok') throw new Error(`Backup integrity check failed: ${String(integrity)}`);

if (!process.argv[2]) {
  readdirSync(backupDirectory)
    .filter(fileName => /^roster-.*\.sqlite$/.test(fileName))
    .sort()
    .reverse()
    .slice(2)
    .forEach(fileName => {
      const backupPath = path.join(backupDirectory, fileName);
      unlinkSync(backupPath);
      for (const sidecarPath of [`${backupPath}-wal`, `${backupPath}-shm`]) {
        if (existsSync(sidecarPath)) unlinkSync(sidecarPath);
      }
    });
}

console.log(`Roster backup created: ${destination}`);
console.log(`Verified ${classes.count} classes and ${students.count} students.`);
