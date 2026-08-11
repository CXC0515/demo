/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTrialScore } from './trialScore';

const points = ['一', '二', '三'].map(point => ({ point, score: 1, description: '' }));

test('derives a fixed-point score from classified rubric points', () => {
  assert.equal(resolveTrialScore(3, points, ['一', '二'], ['三'], 3), 2);
});

test('keeps the model score when rubric points are not fully classified', () => {
  assert.equal(resolveTrialScore(3, points, ['一'], [], 2), 2);
});
