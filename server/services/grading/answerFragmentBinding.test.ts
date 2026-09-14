/** @license SPDX-License-Identifier: Apache-2.0 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { bindAnswerFragments } from './answerFragmentBinding';

test('binds different answers from one shared OCR block', () => {
  const blocks = [{ id: 'shared', text: '2. 济南的冬天\n3. 清澈明亮' }];
  assert.equal(bindAnswerFragments([{ order: 1, blockId: 'shared', quote: '济南的冬天', occurrence: 1 }], blocks).paddleText, '济南的冬天');
  assert.equal(bindAnswerFragments([{ order: 1, blockId: 'shared', quote: '清澈明亮', occurrence: 1 }], blocks).paddleText, '清澈明亮');
});

test('joins one answer across multiple OCR blocks in declared order', () => {
  const result = bindAnswerFragments([
    { order: 2, blockId: 'b', quote: '后半部分', occurrence: 1 },
    { order: 1, blockId: 'a', quote: '前半 部分', occurrence: 1 }
  ], [{ id: 'a', text: '前半\n部分' }, { id: 'b', text: '后半部分' }]);
  assert.equal(result.paddleText, '前半\n部分\n后半部分');
  assert.deepEqual(result.fragments.map(fragment => fragment.matchStatus), ['normalized', 'exact']);
});

test('does not substitute a whole block when a quote is missing', () => {
  const result = bindAnswerFragments([{ order: 1, blockId: 'a', quote: '不存在', occurrence: 1 }], [{ id: 'a', text: '另一个答案' }]);
  assert.equal(result.paddleText, '');
  assert.equal(result.fragments[0]?.matchStatus, 'missing');
  assert.equal(result.reasons.length, 1);
});
