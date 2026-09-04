/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { RosterStudent } from './types';
import { sortStudents } from './studentSorting';

const student = (studentNo: string, name: string, overrides: Partial<RosterStudent> = {}): RosterStudent => ({
  id: studentNo,
  studentId: studentNo,
  studentNo,
  name,
  classId: 'c1',
  className: '七年级 5 班',
  gender: 'male',
  committeeRoleIds: [],
  status: 'good',
  enrollmentStatus: 'active',
  behaviorTags: [],
  parent: { name: '', phone: '', relation: '', remark: '' },
  familyStatus: 'normal',
  observationHistory: [],
  strongKnowledge: [],
  weakKnowledge: [],
  recentHomeworkTrend: [],
  homeworkHistory: [],
  ...overrides
});

test('sorts student numbers naturally and names by Chinese pinyin collation', () => {
  const rows = [student('10', '张三'), student('2', '李四'), student('1', '王五')];
  assert.deepEqual(sortStudents(rows, 'studentNo', 'asc').map(item => item.studentNo), ['1', '2', '10']);
  assert.deepEqual(sortStudents(rows, 'name', 'asc').map(item => item.name), ['李四', '王五', '张三']);
  assert.deepEqual(sortStudents(rows, 'name', 'desc').map(item => item.name), ['张三', '王五', '李四']);
});

test('sorts family state and latest homework score consistently', () => {
  const rows = [
    student('1', '甲', { familyStatus: 'special', recentHomeworkTrend: [60] }),
    student('2', '乙', { familyStatus: 'normal', recentHomeworkTrend: [95] }),
    student('3', '丙', { familyStatus: 'attention', recentHomeworkTrend: [] })
  ];
  assert.deepEqual(sortStudents(rows, 'familyStatus', 'asc').map(item => item.studentNo), ['2', '3', '1']);
  assert.deepEqual(sortStudents(rows, 'recentScore', 'desc').map(item => item.studentNo), ['2', '1', '3']);
});
