/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { VisionValidationItem } from '../../../src/domain/types';
import { buildTrialAnswerEvidence, buildTrialGradingPrompt } from './OpenAICompatibleTrialGrader';

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

test('requires a provisional Paddle-based score even when recognition conflicts', () => {
  const prompt = buildTrialGradingPrompt({ questions: [], submissions: [] }, []);
  assert.match(prompt, /依据 PaddleOCR 主证据给出暂定分数/);
  assert.match(prompt, /不能成为拒绝给暂定分数的理由/);
});
