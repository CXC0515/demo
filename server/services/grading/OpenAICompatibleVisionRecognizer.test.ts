/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { LocatedRegion } from './questionRegionCropper';
import { buildRecognitionRegionPrompt, getWholeQuestionAnswer } from './OpenAICompatibleVisionRecognizer';

const region = (kind: 'text' | 'choice'): LocatedRegion => ({
  displayNo: '2',
  region: { x: 0, y: 0, width: 100, height: 50, pageNumber: 1 },
  locatorSource: 'vision-layout',
  locationStatus: 'located',
  locationReasons: [],
  paddleText: 'Paddle 整题原文',
  cropPath: '/tmp/question.jpg',
  cropUrl: '/question.jpg',
  evidenceUnits: [{
    evidenceId: '2-1',
    kind,
    region: { x: 0, y: 0, width: 50, height: 20, pageNumber: 1 },
    cropPath: '/tmp/evidence.jpg',
    cropUrl: '/evidence.jpg',
    paddleText: '逐空候选',
    paddleTextShared: false,
    provisionalText: '',
    confidence: 1,
    needsReview: false,
    reviewReasons: []
  }]
});

test('text recognition receives whole-question Paddle text without per-field anchoring', () => {
  const prompt = buildRecognitionRegionPrompt(region('text'));
  assert.match(prompt, /Paddle 整题原文/);
  assert.doesNotMatch(prompt, /逐空候选/);
  assert.match(prompt, /answerFields 保持空数组/);
  assert.match(prompt, /不要拆分到逐空字段/);
});

test('choice recognition keeps the Paddle option candidate', () => {
  assert.match(buildRecognitionRegionPrompt(region('choice')), /逐空候选/);
});

test('legacy per-field output is collapsed without duplicating a whole line', () => {
  assert.equal(getWholeQuestionAnswer('', [
    { text: '濯清涟而不妖 周敦颐' },
    { text: '濯清涟而不妖 周敦颐' }
  ]), '濯清涟而不妖 周敦颐');
});
