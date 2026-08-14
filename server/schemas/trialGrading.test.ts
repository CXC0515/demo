/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { trialGradingModelOutputSchema, trialGradingRequestSchema } from './trialGrading';

const request = {
  questions: [{
    questionId: 'q1',
    displayNo: '1',
    stem: '题干',
    fullScore: 2,
    standardAnswer: '答案',
    rubricPoints: [{ point: '采分点', score: 2, description: '说明' }],
    teacherRules: [],
    rubricVersion: 1
  }],
  submissions: [{ assetId: 'asset-1', studentId: 'student-1', studentName: '学生甲', studentNo: '5001' }]
};

test('accepts a bounded trial grading request', () => {
  assert.equal(trialGradingRequestSchema.parse(request).questions[0].fullScore, 2);
});

test('allows the model to defer a score when the rubric is insufficient', () => {
  const result = trialGradingModelOutputSchema.parse({
    samples: [{
      questionId: 'q1',
      assetId: 'asset-1',
      score: null,
      confidence: 0.2,
      matchedPoints: [],
      missedPoints: [],
      reason: '标准答案不足',
      needsTeacherReview: true
    }]
  });
  assert.equal(result.samples[0].score, null);
  assert.equal(result.samples[0].needsTeacherReview, true);
});

test('normalizes grading point objects returned by compatible models', () => {
  const result = trialGradingModelOutputSchema.parse({
    samples: [{
      questionId: 'q1', assetId: 'asset-1', score: 1, confidence: 0.9,
      matchedPoints: [{ point: '内容准确', score: 1 }],
      missedPoints: [{ description: '表达完整' }], reason: '基本符合', needsTeacherReview: false
    }]
  });
  assert.deepEqual(result.samples[0].matchedPoints, ['内容准确']);
  assert.deepEqual(result.samples[0].missedPoints, ['表达完整']);
});

test('rejects invalid confidence and empty submissions', () => {
  assert.equal(trialGradingRequestSchema.safeParse({ ...request, submissions: [] }).success, false);
  assert.equal(trialGradingModelOutputSchema.safeParse({
    samples: [{ questionId: 'q1', assetId: 'asset-1', score: 1, confidence: 1.2, matchedPoints: [], missedPoints: [], reason: '', needsTeacherReview: false }]
  }).success, false);
});
