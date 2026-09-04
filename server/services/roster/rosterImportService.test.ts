/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'demo-roster-import-'));
process.env.ROSTER_DB_PATH = path.join(temporaryDirectory, 'roster.sqlite');

const repository = await import('../../repositories/rosterRepository');
const importer = await import('./rosterImportService');
const { closeRosterDatabase } = await import('../../database/rosterDatabase');

const schoolClass = repository.createClass({
  name: '七年级 5 班',
  grade: '七年级',
  term: '2026 秋季学期',
  headTeacher: '测试教师',
  chineseTeacher: '测试教师',
  status: 'active'
});

after(() => {
  closeRosterDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('infers common headers and updates a uniquely named existing student', () => {
  repository.createStudent({ classId: schoolClass.id, studentNo: '5001', name: '张三' });
  const grid = {
    headers: ['学生姓名', '家长手机号码'],
    rows: [['张三', '13800138000']]
  };

  const preview = importer.previewRosterImport(schoolClass.id, grid);
  assert.equal(preview.mapping[0], 'name');
  assert.equal(preview.mapping[1], 'parentPhone');
  assert.equal(preview.rows[0].action, 'update');

  const result = importer.applyRosterImport(schoolClass.id, grid);
  assert.equal(result.updated.length, 1);
  assert.equal(result.updated[0].parent.phone, '13800138000');
});

test('creates complete new rows but rejects ambiguous names and incomplete additions', () => {
  repository.createStudent({ classId: schoolClass.id, studentNo: '5002', name: '李明' });
  repository.createStudent({ classId: schoolClass.id, studentNo: '5003', name: '李明' });
  const grid = {
    headers: ['学号', '姓名', '联系电话'],
    rows: [
      ['5004', '王五', '13900139000'],
      ['', '李明', '13700137000'],
      ['', '新同学', '13600136000']
    ]
  };

  const preview = importer.previewRosterImport(schoolClass.id, grid);
  assert.deepEqual(preview.rows.map(row => row.action), ['create', 'conflict', 'invalid']);

  const result = importer.applyRosterImport(schoolClass.id, grid);
  assert.equal(result.created.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.equal(repository.findStudentByNo(schoolClass.id, '5004')?.parent.phone, '13900139000');
});
