/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { runRosterMigrations } from './rosterMigrations';

const databasePath = path.resolve(process.env.ROSTER_DB_PATH ?? 'var/data/roster.sqlite');
mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma('foreign_keys = ON');
database.pragma('journal_mode = WAL');
database.pragma('busy_timeout = 5000');
runRosterMigrations(database);

export const getRosterDatabase = () => database;
export const closeRosterDatabase = () => {
  if (database.open) database.close();
};
export const getRosterDatabasePath = () => databasePath;
