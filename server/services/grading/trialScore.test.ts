/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { VisionValidationItem } from '../../../src/domain/types';
import { getObservedAnswer, resolveTrialConfidence, resolveTrialScore, trialNeedsTeacherReview } from './trialScore';

const points = ['一', '二', '三'].map(point => ({ point, score: 1, description: '' }));

const visionItem: VisionValidationItem = {
  displayNo: '1',
  region: { x: 0, y: 0, width: 1, height: 1, pageNumber: 1 },
  locatorSource: 'paddle-layout',
  locationStatus: 'located',
  locationReasons: [],
  cropUrl: '/question-1.jpg',
  paddleText: '',
  lunaText: '学生实际只写了这几个字',
  answerFields: [],
  crossedOutText: [],
  selectedOption: null,
  visualEvidence: '',
  existingMarkings: [],
  confidence: 0.42,
  needsReview: true
};

test('derives a fixed-point score from classified rubric points', () => {
  assert.equal(resolveTrialScore(3, points, ['一', '二'], ['三'], 3), 2);
});

test('keeps the model score when rubric points are not fully classified', () => {
  assert.equal(resolveTrialScore(3, points, ['一'], [], 2), 2);
});

test('keeps observed text independent from grading output', () => {
  assert.equal(getObservedAnswer(visionItem), '学生实际只写了这几个字');
});

test('propagates recognition risk into trial grading', () => {
  assert.equal(resolveTrialConfidence(0.95, visionItem), 0.42);
  assert.equal(trialNeedsTeacherReview(false, visionItem), true);
});
