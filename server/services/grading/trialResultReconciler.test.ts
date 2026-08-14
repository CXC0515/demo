/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { CalibrationSample, TrialGradingResult } from '../../../src/domain/types';
import { buildTeacherAnswerOverrides, mergeRegradedQuestionSamples } from './trialResultReconciler';

const sample = (overrides: Partial<CalibrationSample>): CalibrationSample => ({
  id: 'q1-a1', questionId: 'q1', studentId: 's1', studentName: '学生', studentNo: '01', sampleType: 'middle', rawImageDescription: '', ocrText: '原文', ocrConfidence: 0.9, aiScore: 1, fullScore: 2, gradingConfidence: 0.9, matchedPoints: [], missedPoints: [], sourceAssetId: 'a1', status: 'pending', rubricVersion: 1, ...overrides
});

const result = (samples: CalibrationSample[]): TrialGradingResult => ({ taskId: 'task', model: 'model', samples, createdAt: '' });

test('regrades pending samples while preserving confirmed samples and other questions', () => {
  const confirmed = sample({ id: 'q1-a1', sourceAssetId: 'a1', status: 'confirmed', teacherScore: 2 });
  const pending = sample({ id: 'q1-a2', sourceAssetId: 'a2' });
  const otherQuestion = sample({ id: 'q2-a1', questionId: 'q2' });
  const refreshed = sample({ id: 'q1-a2', sourceAssetId: 'a2', aiScore: 2, rubricVersion: 2 });
  const merged = mergeRegradedQuestionSamples(result([confirmed, pending, otherQuestion]), 'q1', 2, [refreshed]);
  assert.equal(merged.find(item => item.id === 'q1-a1')?.teacherScore, 2);
  assert.equal(merged.find(item => item.id === 'q1-a1')?.rubricVersion, 2);
  assert.equal(merged.find(item => item.id === 'q1-a2')?.aiScore, 2);
  assert.ok(merged.some(item => item.id === 'q2-a1'));
});

test('retains teacher OCR corrections as regrading overrides', () => {
  const overrides = buildTeacherAnswerOverrides(result([sample({ teacherCorrectedText: '教师修正' })]), 'q1', '9');
  assert.equal(overrides.get('a1:9'), '教师修正');
});
