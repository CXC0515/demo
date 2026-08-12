/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { appendMaterialList, StoredMaterial } from './materialRepository';

test('appending student submissions preserves previously uploaded assets', () => {
  const existing = [
    { id: 'assignment', kind: 'assignment' },
    { id: 'student-1', kind: 'student-submission' },
    { id: 'student-2', kind: 'student-submission' },
    { id: 'student-3', kind: 'student-submission' }
  ] as StoredMaterial[];
  const uploaded = [
    { id: 'student-4', kind: 'student-submission' },
    { id: 'student-5', kind: 'student-submission' }
  ] as StoredMaterial[];

  assert.deepEqual(
    appendMaterialList(existing, uploaded).map(asset => asset.id),
    ['assignment', 'student-1', 'student-2', 'student-3', 'student-4', 'student-5']
  );
});
