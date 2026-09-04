/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentAsset, NormalizedDocument, RosterStudent, SubmissionPage } from './types';
import { buildSubmissionPages, getReadableStudentNos, reconcileSubmissionRoster } from './submissionRoster';

const student = (studentNo: string, name: string): RosterStudent => ({
  id: `student-${studentNo}`,
  studentId: `student-${studentNo}`,
  studentNo,
  name,
  classId: 'c5',
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
  homeworkHistory: []
});

const page = (id: string, studentNo: string): SubmissionPage => ({
  id,
  sequence: Number(id),
  expectedStudentName: '',
  detectedStudentNo: studentNo,
  pageCount: 1,
  ocrConfidence: 0.95,
  status: 'matched'
});

test('extracts only readable student numbers for the roster API', () => {
  assert.deepEqual(getReadableStudentNos([page('1', ' 5001 '), page('2', '无法识别'), page('3', '')]), ['5001']);
});

test('maps matched, unknown, duplicate and unreadable pages without guessing identity', () => {
  const first = student('5001', '学生甲');
  const second = student('5002', '学生乙');
  const result = reconcileSubmissionRoster(
    [page('1', '5001'), page('2', '5001'), page('3', '9999'), page('4', '无法识别')],
    {
      matched: [first],
      missing: [second],
      unknownStudentNos: ['9999'],
      duplicateStudentNos: ['5001']
    }
  );

  assert.deepEqual(result.pages.map(item => item.rosterMatchStatus), [
    'duplicate-student-no',
    'duplicate-student-no',
    'unknown-student-no',
    'unreadable-student-no'
  ]);
  assert.ok(result.pages.every(item => item.studentId === undefined));
  assert.deepEqual(result.missingSubmissions, [{
    studentId: second.studentId,
    studentName: second.name,
    studentNo: second.studentNo,
    status: 'missing'
  }]);
});

test('binds a unique class number to the authoritative student id and name', () => {
  const first = student('5001', '学生甲');
  const result = reconcileSubmissionRoster([page('1', '5001')], {
    matched: [first],
    missing: [],
    unknownStudentNos: [],
    duplicateStudentNos: []
  });

  assert.equal(result.pages[0].studentId, first.studentId);
  assert.equal(result.pages[0].expectedStudentName, first.name);
  assert.equal(result.pages[0].rosterMatchStatus, 'matched');
});

test('builds submission pages from parsed files without guessing ambiguous student numbers', () => {
  const assets: DocumentAsset[] = [
    { id: 'asset-1', taskId: 'task-1', kind: 'student-submission', fileName: '甲.pdf', mimeType: 'application/pdf', status: 'ready' },
    { id: 'asset-2', taskId: 'task-1', kind: 'student-submission', fileName: '混合.pdf', mimeType: 'application/pdf', status: 'needs-review' }
  ];
  const document = (assetId: string, text: string): NormalizedDocument => ({
    assetId,
    sourceFormat: 'pdf',
    markdown: text,
    blocks: [{ id: `${assetId}-block`, order: 1, type: 'paragraph', text, confidence: 0.96 }],
    resources: [],
    warnings: [],
    pageCount: 1,
    parsedAt: new Date(0).toISOString()
  });
  const pages = buildSubmissionPages(
    assets,
    [document('asset-1', '学号：5001'), document('asset-2', '学号：5001 / 5002')],
    [student('5001', '学生甲'), student('5002', '学生乙')]
  );

  assert.equal(pages[0].detectedStudentNo, '5001');
  assert.equal(pages[0].status, 'matched');
  assert.equal(pages[1].detectedStudentNo, '5001 / 5002');
  assert.equal(pages[1].status, 'needs-review');
});

test('matches a unique roster name from the file name before requiring a student number', () => {
  const assets: DocumentAsset[] = [
    { id: 'asset-1', taskId: 'task-1', kind: 'student-submission', fileName: '学生甲.pdf', mimeType: 'application/pdf', status: 'ready' }
  ];
  const pages = buildSubmissionPages(assets, [], [student('5001', '学生甲'), student('5002', '学生乙')]);

  assert.equal(pages[0].expectedStudentName, '学生甲');
  assert.equal(pages[0].detectedStudentNo, '5001');
  assert.equal(pages[0].rosterMatchStatus, 'pending');
  assert.equal(pages[0].status, 'matched');
});

test('uses the student number to disambiguate duplicate names and otherwise requests review', () => {
  const first = student('5001', '学生甲');
  const second = { ...student('5002', '学生甲'), id: 'student-5002', studentId: 'student-5002' };
  const assets: DocumentAsset[] = [
    { id: 'asset-1', taskId: 'task-1', kind: 'student-submission', fileName: '学生甲.pdf', mimeType: 'application/pdf', status: 'ready' },
    { id: 'asset-2', taskId: 'task-1', kind: 'student-submission', fileName: '学生甲-5002.pdf', mimeType: 'application/pdf', status: 'ready' }
  ];
  const document: NormalizedDocument = {
    assetId: 'asset-2',
    sourceFormat: 'pdf',
    markdown: '学号：5002',
    blocks: [{ id: 'block-1', order: 1, type: 'paragraph', text: '学号：5002', confidence: 0.96 }],
    resources: [],
    warnings: [],
    pageCount: 1,
    parsedAt: new Date(0).toISOString()
  };
  const pages = buildSubmissionPages(assets, [document], [first, second]);

  assert.equal(pages[0].rosterMatchStatus, 'ambiguous-student-name');
  assert.equal(pages[0].status, 'needs-review');
  assert.equal(pages[1].detectedStudentNo, '5002');
  assert.equal(pages[1].expectedStudentName, '学生甲');
});
