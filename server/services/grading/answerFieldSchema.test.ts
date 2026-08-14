/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalyzedQuestion } from '../../../src/domain/types';
import { buildExpectedAnswerFields } from './answerFieldSchema';

test('derives every answer slot from subquestion stems without material-specific coordinates', () => {
  const question = {
    displayNo: '1',
    stem: '古诗文填空',
    subquestions: [
      { displayNo: '1①', stem: '前句，__________。', subquestions: [] },
      { displayNo: '1②', stem: '__________。（________《篇名》）', subquestions: [] }
    ]
  } as unknown as AnalyzedQuestion;
  assert.deepEqual(buildExpectedAnswerFields(question).map(field => field.fieldId), ['1①-1', '1②-1', '1②-2']);
});
