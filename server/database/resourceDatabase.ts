/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { runtimeConfig } from "../config/runtimeConfig";
import { runResourceMigrations } from "./resourceMigrations";

export const createResourceDatabase = (databasePath: string) => {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  runResourceMigrations(database);
  return database;
};

const databasePath = runtimeConfig.resourceDatabasePath;
const database = createResourceDatabase(databasePath);

export const getResourceDatabase = () => database;
export const getResourceDatabasePath = () => databasePath;
export const closeResourceDatabase = () => {
  if (database.open) database.close();
};
