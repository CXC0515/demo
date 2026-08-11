/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { VisionValidationItem } from '../../../src/domain/types';
import { buildTrialAnswerEvidence } from './OpenAICompatibleTrialGrader';

const item: VisionValidationItem = {
  displayNo: '1',
  region: { x: 0, y: 0, width: 1, height: 1, pageNumber: 1 },
  locatorSource: 'paddle-layout',
  locationStatus: 'located',
  locationReasons: [],
  cropUrl: '/question-1.jpg',
  paddleText: 'Paddle 主证据',
  lunaText: 'Luna 复核文本',
  crossedOutText: ['划掉内容'],
  selectedOption: null,
  visualEvidence: '',
  existingMarkings: ['2分'],
  confidence: 0.9,
  needsReview: false
};

test('uses Paddle as the grading answer while preserving Luna review evidence', () => {
  const evidence = buildTrialAnswerEvidence(item);
  assert.equal(evidence.answer, 'Paddle 主证据');
  assert.equal(evidence.lunaReview, 'Luna 复核文本');
  assert.equal(evidence.recognitionConflict, true);
  assert.equal(evidence.needsReview, true);
  assert.deepEqual(evidence.crossedOutText, ['划掉内容']);
});
