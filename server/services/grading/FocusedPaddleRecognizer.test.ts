/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { extractFocusedPaddleText } from './FocusedPaddleRecognizer';

test('extracts focused OCR blocks in visual order', () => {
  const text = extractFocusedPaddleText([{ prunedResult: { parsing_res_list: [
    { block_content: '山海环绕', block_bbox: [20, 80, 200, 110] },
    { block_content: '9. 战火不息', block_bbox: [20, 20, 200, 50] }
  ] } }]);
  assert.equal(text, '9. 战火不息\n山海环绕');
});

test('falls back to markdown when the focused result has no blocks', () => {
  assert.equal(extractFocusedPaddleText([{ markdownText: '第九题答案' }]), '第九题答案');
});
