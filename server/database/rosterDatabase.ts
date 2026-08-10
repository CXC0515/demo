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

const now = new Date().toISOString();
database.prepare(`
  INSERT OR IGNORE INTO classes (
    id, name, grade, term, head_teacher, chinese_teacher, textbook_version,
    default_submit_time, status, student_count, created_at, updated_at
  ) VALUES ('c5', '七年级 5 班', '七年级', '2026 秋季学期', '待补充', '王老师',
    '统编版七年级上册', '08:00', 'active', 0, ?, ?)
`).run(now, now);

export const getRosterDatabase = () => database;
export const closeRosterDatabase = () => {
  if (database.open) database.close();
};
export const getRosterDatabasePath = () => databasePath;
