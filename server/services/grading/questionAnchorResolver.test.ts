/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { PaddleParserArtifact } from '../../schemas/paddleParserArtifact';
import { resolveQuestionAnchors } from './questionAnchorResolver';

const line = (text: string, x: number, y: number, width = 200, height = 22, confidence = 0.95) => ({
  text,
  confidence,
  boundingBox: [x, y, x + width, y + height] as [number, number, number, number]
});

const artifact = {
  model: 'PaddleOCR-VL-1.6',
  ocrModel: 'PP-OCRv6',
  pages: [{
    pageNumber: 1,
    prunedResult: { width: 1190, height: 1684, parsing_res_list: [] }
  }],
  ocrPages: [{
    pageNumber: 1,
    width: 1190,
    height: 1684,
    lines: [
      line('1. 答题前请填写姓名', 117, 349),
      line('2. 客观题使用规定用笔', 117, 365),
      line('3. 必须在题号区域作答', 117, 375),
      line('6. 第六题答案', 436, 107),
      line('7 [A] [B] [C] [D]', 439, 218),
      line('8. 第八题答案', 436, 270),
      line('9. 第九题答案', 436, 375),
      line('10. 第十题答案', 436, 414),
      line('1. 第一题答案', 106, 421),
      line('2. 第二题答案', 108, 570),
      line('3 [A] [B] [C] [D]', 117, 632),
      line('4 [A] [B] [C] [D]', 117, 644),
      line('5. 第五题答案', 110, 696),
      line('11 [A] [B] [C] [D]', 437, 582),
      line('12. 第十二题答案', 436, 637),
      line('13 [A] [B] [C] [D]', 437, 721),
      line('14. 第十四题答案', 761, 128),
      line('15 [A] [B] [C] [D]', 763, 263),
      line('16. 第十六题答案', 761, 314),
      line('17. 第十七题答案', 763, 381),
      line('18 [A] [B] [C] [D]', 763, 489),
      line('19. 第十九题答案', 763, 542),
      line('20. 第二十题答案', 761, 614),
      line('21. 第二十一题答案', 761, 677),
      line('22. 第二十二题答案', 108, 916),
      line('23. 作文', 106, 1061)
    ]
  }]
} satisfies PaddleParserArtifact;

test('selects the spatially continuous question sequence instead of numbered instructions', () => {
  const resolved = resolveQuestionAnchors(artifact, Array.from({ length: 23 }, (_, index) => String(index + 1)));
  assert.equal(resolved.get('1')?.anchor.boundingBox.y, 421);
  assert.equal(resolved.get('2')?.anchor.boundingBox.y, 570);
  assert.equal(resolved.get('3')?.anchor.boundingBox.y, 632);
});

test('uses the next OCRv6 anchor in the same lane as the question boundary', () => {
  const resolved = resolveQuestionAnchors(artifact, Array.from({ length: 23 }, (_, index) => String(index + 1)));
  const ninth = resolved.get('9');
  assert.ok(ninth);
  assert.equal(ninth.anchor.boundingBox.x, 436);
  assert.ok(ninth.boundingBox.y < 375);
  assert.ok(ninth.boundingBox.y + ninth.boundingBox.height > 414);
  assert.ok(ninth.recognitionBoundingBox.y + ninth.recognitionBoundingBox.height < 414);
  assert.match(ninth.ocrText, /^9\. 第九题答案$/);
  assert.doesNotMatch(ninth.ocrText, /第八题|第十题/);
});

test('keeps legacy VL-only artifacts usable', () => {
  assert.equal(resolveQuestionAnchors({ ...artifact, ocrPages: [] }, ['1']).size, 0);
});
