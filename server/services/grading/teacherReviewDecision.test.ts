/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { CalibrationSample } from '../../../src/domain/types';
import { applyTeacherReviewDecision } from './teacherReviewDecision';

const sample: CalibrationSample = {
  id: 'sample', studentId: 'student', studentName: '学生', studentNo: '1', sampleType: 'ocr-risk',
  rawImageDescription: '', rawOcrText: '原识别', ocrText: '原识别', ocrConfidence: 0.7,
  aiScore: 2, fullScore: 3, gradingConfidence: 0.6, matchedPoints: [], missedPoints: [],
  status: 'pending', rubricVersion: 1
};

test('persists a teacher decision and corrected OCR as the final result', () => {
  const result = applyTeacherReviewDecision(sample, { finalScore: 3, reason: '原图可确认', resultSource: 'teacher-manual', correctedText: '修正识别' });
  assert.equal(result.status, 'confirmed');
  assert.equal(result.teacherScore, 3);
  assert.equal(result.teacherCorrectedText, '修正识别');
  assert.equal(result.isFinal, true);
});

test('rejects invalid teacher and AI-confirmed scores', () => {
  assert.throws(() => applyTeacherReviewDecision(sample, { finalScore: 4, reason: '超分', resultSource: 'teacher-manual' }), /TEACHER_SCORE_EXCEEDS_FULL_SCORE/);
  assert.throws(() => applyTeacherReviewDecision(sample, { finalScore: 1, reason: '不一致', resultSource: 'ai-confirmed' }), /AI_SCORE_CONFIRMATION_MISMATCH/);
});
