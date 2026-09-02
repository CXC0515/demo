/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import Database from 'better-sqlite3';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'demo-roster-sqlite-'));
const databasePath = path.join(temporaryDirectory, 'roster.sqlite');
process.env.ROSTER_DB_PATH = databasePath;

const repository = await import('./rosterRepository');
const { closeRosterDatabase } = await import('../database/rosterDatabase');
const primaryClass = repository.createClass({
  name: '七年级 5 班',
  grade: '七年级',
  term: '2026 秋季学期',
  headTeacher: '测试教师',
  chineseTeacher: '测试教师',
  textbookVersion: '统编版七年级上册',
  defaultSubmitTime: '08:00',
  status: 'active'
});

after(() => {
  closeRosterDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('persists authoritative roster relationships and constraints', () => {
  assert.deepEqual(repository.listClasses().map(item => item.id), [primaryClass.id]);
  const targetClass = repository.createClass({
    name: '测试转入班',
    grade: '七年级',
    term: '2026 秋季学期',
    headTeacher: '测试教师',
    chineseTeacher: '测试教师',
    textbookVersion: '统编版七年级上册',
    defaultSubmitTime: '08:00',
    status: 'active'
  });
  const first = repository.createStudent({
    studentId: 'sqlite-test-student-1',
    classId: primaryClass.id,
    studentNo: '5001',
    name: '测试学生甲',
    gender: 'female',
    isRepresentative: true
  });
  assert.equal(first.isRepresentative, true);

  const fiveClass = repository.listClasses().find(item => item.id === primaryClass.id);
  assert.equal(fiveClass?.studentCount, 1);
  assert.deepEqual(fiveClass?.representatives, [first.studentId]);

  assert.throws(() => repository.createStudent({
    classId: primaryClass.id,
    studentNo: '5001',
    name: '重复学号'
  }), /DUPLICATE_STUDENT_NO/);

  const second = repository.createStudent({
    studentId: 'sqlite-test-student-2',
    classId: primaryClass.id,
    studentNo: '5002',
    name: '测试学生乙'
  });
  const match = repository.matchSubmissions(primaryClass.id, ['5001', '5001', '9999']);
  assert.deepEqual(match.matched.map(item => item.studentId), [first.studentId]);
  assert.deepEqual(match.missing.map(item => item.studentId), [second.studentId]);
  assert.deepEqual(match.unknownStudentNos, ['9999']);
  assert.deepEqual(match.duplicateStudentNos, ['5001']);

  repository.updateClass(primaryClass.id, { representatives: [second.studentId] });
  assert.equal(repository.findStudentByNo(primaryClass.id, '5001')?.isRepresentative, false);
  assert.equal(repository.findStudentByNo(primaryClass.id, '5002')?.isRepresentative, true);

  const moved = repository.updateStudent(second.studentId, {
    classId: targetClass.id,
    studentNo: '3999',
    name: second.name,
    gender: second.gender,
    isRepresentative: true,
    status: second.status,
    behaviorTags: second.behaviorTags,
    parent: second.parent,
    familyStatus: second.familyStatus,
    observationHistory: second.observationHistory,
    strongKnowledge: second.strongKnowledge,
    weakKnowledge: second.weakKnowledge,
    recentHomeworkTrend: second.recentHomeworkTrend,
    homeworkHistory: second.homeworkHistory
  });
  assert.equal(moved?.classId, targetClass.id);
  assert.equal(moved?.isRepresentative, false);
});

test('database remains readable after the repository connection closes', () => {
  closeRosterDatabase();
  const reopened = new Database(databasePath, { readonly: true });
  const student = reopened.prepare('SELECT name FROM students WHERE id = ?').get('sqlite-test-student-1') as { name: string };
  assert.equal(student.name, '测试学生甲');
  reopened.close();
});
