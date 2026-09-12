/** @license SPDX-License-Identifier: Apache-2.0 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { sourcePageImagePath } from './sourcePageImage';

test('resolves grading source pages from the page-images directory', () => {
  const target = sourcePageImagePath('asset-1', 2, 'page-2.jpg');
  assert.match(target, /uploads\/parsed\/asset-1\/page-images\/page-2\.jpg$/);
  assert.doesNotMatch(target, /resources\/page-2\.jpg$/);
});
