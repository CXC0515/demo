/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentAsset, NormalizedDocument, RosterStudent } from './types';
import { buildMissingSubmissions, buildSubmissionPages } from './submissionRoster';

const student = (studentNo: string, name: string): RosterStudent => ({
  id: `student-${studentNo}`, studentId: `student-${studentNo}`, studentNo, name,
  classId: 'c5', className: '七年级 5 班', gender: 'male', committeeRoleIds: [], status: 'good',
  enrollmentStatus: 'active', behaviorTags: [], parent: { name: '', phone: '', relation: '', remark: '' },
  familyStatus: 'normal', observationHistory: [], strongKnowledge: [], weakKnowledge: [], recentHomeworkTrend: [], homeworkHistory: []
});

const asset = (id: string, fileName = `${id}.pdf`): DocumentAsset => ({
  id, taskId: 'task-1', kind: 'student-submission', fileName, mimeType: 'application/pdf', status: 'ready'
});

const document = (assetId: string, blocks: string[]): NormalizedDocument => ({
  assetId, sourceFormat: 'pdf', markdown: blocks.join('\n'),
  blocks: blocks.map((text, index) => ({ id: `${assetId}-${index}`, order: index, type: 'paragraph', text, confidence: 0.96 })),
  resources: [], warnings: [], pageCount: 1, parsedAt: new Date(0).toISOString()
});

test('matches a unique roster name anywhere in OCR content', () => {
  const blocks = Array.from({ length: 25 }, (_, index) => index === 24 ? '答题人：学生甲' : `第${index + 1}题`);
  const pages = buildSubmissionPages([asset('a1')], [document('a1', blocks)], [student('5001', '学生甲')]);
  assert.equal(pages[0].studentId, 'student-5001');
  assert.equal(pages[0].detectedStudentName, '学生甲');
  assert.equal(pages[0].nameMatchSource, 'ocr');
  assert.equal(pages[0].rosterMatchStatus, 'matched');
});

test('matches a roster name from the file name', () => {
  const pages = buildSubmissionPages([asset('a1', '七五班-学生乙.pdf')], [], [student('5002', '学生乙')]);
  assert.equal(pages[0].studentId, 'student-5002');
  assert.equal(pages[0].nameMatchSource, 'file-name');
});

test('does not use question numbers to infer identity', () => {
  const pages = buildSubmissionPages([asset('a1')], [document('a1', ['第5001题', '答案：5002'])], [student('5001', '学生甲'), student('5002', '学生乙')]);
  assert.equal(pages[0].rosterMatchStatus, 'unreadable-student-name');
  assert.equal(pages[0].studentId, undefined);
});

test('keeps duplicate names ambiguous even when a student number appears', () => {
  const pages = buildSubmissionPages([asset('a1')], [document('a1', ['学生甲', '学号：5002'])], [student('5001', '学生甲'), student('5002', '学生甲')]);
  assert.equal(pages[0].rosterMatchStatus, 'ambiguous-student-name');
  assert.equal(pages[0].studentId, undefined);
});

test('marks multiple different roster names in one submission as ambiguous', () => {
  const pages = buildSubmissionPages([asset('a1')], [document('a1', ['学生甲', '学生乙'])], [student('5001', '学生甲'), student('5002', '学生乙')]);
  assert.equal(pages[0].rosterMatchStatus, 'ambiguous-student-name');
});

test('derives missing students from confirmed name matches', () => {
  const roster = [student('5001', '学生甲'), student('5002', '学生乙')];
  const pages = buildSubmissionPages([asset('a1', '学生甲.pdf')], [], roster);
  assert.deepEqual(buildMissingSubmissions(pages, roster).map(item => item.studentName), ['学生乙']);
});
