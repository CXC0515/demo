/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import type { SchoolClass } from '../../../src/domain/types';
import { matchScheduleClass, normalizeClassLabel } from './classEntityMatcher';

const schoolClass = (id: string, name: string, grade: string, term = '2026 春季学期'): SchoolClass => ({
  id, name, grade, term, headTeacher: '', studentCount: 0, status: 'active',
});

const classes = [
  schoolClass('class-9', '初一（9）班', '七年级'),
  schoolClass('class-10', '初一（10）班', '七年级'),
  schoolClass('stars', '星辰班', '七年级'),
  schoolClass('innovation', '高一创新实验班', '高一年级'),
];

test('normalizes full-width punctuation without discarding meaningful names', () => {
  assert.equal(normalizeClassLabel(' 初一【10】班 '), '初一10班');
  assert.equal(normalizeClassLabel('高一·创新实验班'), '高一创新实验班');
});

test('matches arbitrary existing class names from OCR cell evidence', () => {
  const result = matchScheduleClass({ recognizedClassText: '综合实践  星辰班', confidence: 0.97 }, classes);
  assert.equal(result.classId, 'stars');
  assert.equal(result.match.reason, 'normalized-name');
});

test('matches grade and class-number aliases as supplementary evidence', () => {
  assert.equal(matchScheduleClass({ recognizedClassText: '语文 七年级十班' }, classes).classId, 'class-10');
  assert.equal(matchScheduleClass({ recognizedClassText: '语文 初一 9 班' }, classes).classId, 'class-9');
});

test('uses a validated high-confidence catalog selection when text has no local match', () => {
  const result = matchScheduleClass({ recognizedClassText: '创新班', aiCandidateClassId: 'innovation', confidence: 0.92 }, classes);
  assert.equal(result.classId, 'innovation');
  assert.equal(result.match.reason, 'ai-catalog-selection');
});

test('rejects catalog ids outside the current workspace', () => {
  const result = matchScheduleClass({ recognizedClassText: '', aiCandidateClassId: 'other-workspace', confidence: 0.99 }, classes);
  assert.equal(result.classId, '');
  assert.equal(result.match.reason, 'no-candidate');
});

test('keeps conflicting OCR and AI evidence unresolved', () => {
  const result = matchScheduleClass({ recognizedClassText: '初一（9）班', aiCandidateClassId: 'class-10', confidence: 0.99 }, classes);
  assert.equal(result.classId, '');
  assert.equal(result.match.reason, 'conflicting-evidence');
  assert.deepEqual(result.match.candidateClassIds.sort(), ['class-10', 'class-9']);
});

test('does not guess between duplicate active class names', () => {
  const duplicates = [schoolClass('spring', '星辰班', '七年级', '2026 春季学期'), schoolClass('autumn', '星辰班', '七年级', '2026 秋季学期')];
  const result = matchScheduleClass({ recognizedClassText: '星辰班', aiCandidateClassId: 'spring', confidence: 0.99 }, duplicates);
  assert.equal(result.classId, '');
  assert.equal(result.match.reason, 'ambiguous-candidates');
});
