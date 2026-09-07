/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { runtimeConfig } from '../config/runtimeConfig';

mkdirSync(path.dirname(runtimeConfig.authDatabasePath), { recursive: true });
const database = new Database(runtimeConfig.authDatabasePath);
database.pragma('foreign_keys = ON');
database.pragma('journal_mode = WAL');
database.pragma('busy_timeout = 5000');

database.exec(`
  CREATE TABLE IF NOT EXISTS app_workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_workspace_members (
    user_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'teacher')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    FOREIGN KEY(workspace_id) REFERENCES app_workspaces(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS app_workspace_single_member
    ON app_workspace_members(workspace_id);
  CREATE TABLE IF NOT EXISTS app_invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK(role IN ('owner', 'teacher')),
    workspace_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'consumed', 'revoked')),
    expires_at TEXT NOT NULL,
    created_by_user_id TEXT,
    consumed_by_user_id TEXT,
    created_at TEXT NOT NULL,
    consumed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS app_invitations_email_status
    ON app_invitations(email, status);
  CREATE TABLE IF NOT EXISTS app_teacher_profiles (
    user_id TEXT PRIMARY KEY,
    profile_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  );
`);

export const getAuthDatabase = () => database;
export const closeAuthDatabase = () => {
  if (database.open) database.close();
};
