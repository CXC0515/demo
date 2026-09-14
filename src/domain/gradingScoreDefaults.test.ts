/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvedQuestionScore, resolvedUnitScore, resolveRubricScores } from './gradingScoreDefaults';

test('defaults each scoreless leaf question to one point', () => {
  assert.equal(resolvedUnitScore({ score: null }), 1);
  assert.equal(resolvedQuestionScore({ score: null, subquestions: [] }), 1);
});

test('defaults each independently judgeable rubric point to one point', () => {
  const rubricPoints = [
    { point: '第一空', score: null, description: '' },
    { point: '第二空', score: null, description: '' },
    { point: '第三空', score: null, description: '' },
    { point: '第四空', score: null, description: '' }
  ];
  assert.equal(resolvedUnitScore({ score: null, rubricPoints }), 4);
  assert.equal(resolvedQuestionScore({ score: null, subquestions: [], rubricPoints }), 4);
});

test('uses the sum of minimum units when the containing question has no score', () => {
  assert.equal(resolvedQuestionScore({ score: null, subquestions: [{ score: null }, { score: 2 }] as never }), 3);
});

test('preserves explicit scores', () => {
  assert.equal(resolvedQuestionScore({ score: 5, subquestions: [{ score: null }] as never }), 5);
});

test('distributes unresolved rubric scores within the unit total', () => {
  assert.deepEqual(resolveRubricScores([
    { point: '要点一', score: null, description: '' },
    { point: '要点二', score: null, description: '' }
  ], 1, '作答正确').map(point => point.score), [0.5, 0.5]);
});

test('creates one neutral fallback rubric when a minimum unit has none', () => {
  assert.deepEqual(resolveRubricScores([], 1, '参考答案要点'), [{ point: '参考答案要点', score: 1, description: '' }]);
});
