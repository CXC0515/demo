/** @license SPDX-License-Identifier: Apache-2.0 */

import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { runRosterMigrations } from './rosterMigrations';

test('migration 11 removes the obsolete class teacher column without losing classes', () => {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      term TEXT NOT NULL,
      head_teacher TEXT NOT NULL,
      chinese_teacher TEXT NOT NULL,
      status TEXT NOT NULL
    );
    INSERT INTO classes VALUES ('class-1', '七年级 1 班', '七年级', '2026 秋季学期', '李老师', '旧任课教师', 'active');
    PRAGMA user_version = 10;
  `);

  runRosterMigrations(database);

  const columns = database.prepare('PRAGMA table_info(classes)').all() as Array<{ name: string }>;
  assert.equal(columns.some(column => column.name === 'chinese_teacher'), false);
  assert.deepEqual(database.prepare('SELECT id, name, head_teacher FROM classes').get(), {
    id: 'class-1', name: '七年级 1 班', head_teacher: '李老师'
  });
  assert.equal(database.pragma('user_version', { simple: true }), 11);
  database.close();
});
