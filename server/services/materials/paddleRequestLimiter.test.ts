/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { withPaddleRequestSlot } from './paddleRequestLimiter';

test('bounds concurrent Paddle requests without dropping queued work', async () => {
  let active = 0;
  let peak = 0;
  const completed: number[] = [];
  await Promise.all(Array.from({ length: 6 }, (_, index) => withPaddleRequestSlot(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    completed.push(index);
    active -= 1;
  })));
  assert.equal(peak, 2);
  assert.equal(completed.length, 6);
});
