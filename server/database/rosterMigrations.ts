/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type Database from 'better-sqlite3';

interface Migration {
  version: number;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        grade TEXT NOT NULL,
        term TEXT NOT NULL,
        head_teacher TEXT NOT NULL,
        chinese_teacher TEXT NOT NULL,
        textbook_version TEXT NOT NULL,
        default_submit_time TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (term, name)
      );

      CREATE TABLE students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
        status TEXT NOT NULL CHECK (status IN ('good', 'warning', 'risk', 'outstanding')),
        profile_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE class_memberships (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        student_id TEXT NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        student_no TEXT NOT NULL,
        is_representative INTEGER NOT NULL DEFAULT 0 CHECK (is_representative IN (0, 1)),
        status TEXT NOT NULL CHECK (status IN ('active', 'transferred', 'withdrawn', 'suspended')),
        joined_at TEXT NOT NULL,
        left_at TEXT,
        UNIQUE (class_id, student_no)
      );

      CREATE INDEX class_memberships_student_idx
        ON class_memberships (student_id);
      CREATE INDEX class_memberships_class_status_idx
        ON class_memberships (class_id, status);
    `
  },
  {
    version: 2,
    sql: `
      ALTER TABLE classes ADD COLUMN student_count INTEGER;
    `
  }
];

export const runRosterMigrations = (database: Database.Database) => {
  const currentVersion = database.pragma('user_version', { simple: true }) as number;
  const pending = migrations.filter(migration => migration.version > currentVersion);
  if (!pending.length) return;

  database.transaction(() => {
    pending.forEach(migration => {
      database.exec(migration.sql);
      database.pragma(`user_version = ${migration.version}`);
    });
  })();
};
