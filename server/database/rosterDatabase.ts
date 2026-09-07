/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { runtimeConfig } from '../config/runtimeConfig';
import { getOptionalWorkspaceContext } from '../context/workspaceContext';
import { runRosterMigrations } from './rosterMigrations';

const databases = new Map<string, Database.Database>();

export const getRosterDatabasePath = () => getOptionalWorkspaceContext()
  ? path.join(getOptionalWorkspaceContext()!.dataDirectory, 'roster.sqlite')
  : runtimeConfig.rosterDatabasePath;
const resolveRosterDatabase = () => {
  const databasePath = getRosterDatabasePath();
  const existing = databases.get(databasePath);
  if (existing?.open) return existing;
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  runRosterMigrations(database);
  databases.set(databasePath, database);
  return database;
};
const databaseProxy = new Proxy({} as Database.Database, {
  get: (_target, property) => {
    const database = resolveRosterDatabase() as unknown as Record<PropertyKey, unknown>;
    const value = database[property];
    return typeof value === 'function' ? value.bind(database) : value;
  },
});
export const getRosterDatabase = () => databaseProxy;
export const closeRosterDatabase = () => {
  for (const database of databases.values()) if (database.open) database.close();
  databases.clear();
};
