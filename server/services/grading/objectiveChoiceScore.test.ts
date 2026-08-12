/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreObjectiveChoice } from './objectiveChoiceScore';

test('scores a recognized objective choice deterministically', () => {
  assert.equal(scoreObjectiveChoice('B', 'B', 1), 1);
  assert.equal(scoreObjectiveChoice('A', 'B', 1), 0);
});

test('leaves non-choice standards to rubric grading', () => {
  assert.equal(scoreObjectiveChoice('A', '示例答案', 2), null);
  assert.equal(scoreObjectiveChoice(null, 'A', 2), null);
});
