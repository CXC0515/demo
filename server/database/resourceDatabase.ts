/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { runtimeConfig } from "../config/runtimeConfig";
import { getOptionalWorkspaceContext } from "../context/workspaceContext";
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

const databases = new Map<string, Database.Database>();
export const getResourceDatabasePath = () => getOptionalWorkspaceContext()
  ? path.join(getOptionalWorkspaceContext()!.dataDirectory, "resources.sqlite")
  : runtimeConfig.resourceDatabasePath;
export const getResourceDatabase = () => {
  const databasePath = getResourceDatabasePath();
  const existing = databases.get(databasePath);
  if (existing?.open) return existing;
  const database = createResourceDatabase(databasePath);
  databases.set(databasePath, database);
  return database;
};
export const closeResourceDatabase = () => {
  for (const database of databases.values()) if (database.open) database.close();
  databases.clear();
};
