/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPaddleInvalidRequest } from './PaddleVisionMaterialParser';

test('classifies Paddle shared queue saturation separately from invalid files', () => {
  assert.equal(classifyPaddleInvalidRequest('Bad request: 任务提交队列已满，请稍后重试'), 'PADDLEOCR_QUEUE_FULL');
  assert.equal(classifyPaddleInvalidRequest('Bad request: unsupported image encoding'), 'PADDLEOCR_INVALID_REQUEST');
});
