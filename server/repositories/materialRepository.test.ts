/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { appendMaterialList, removeMaterialListById, StoredMaterial } from './materialRepository';

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

test('removes only explicitly selected student submissions', () => {
  const current = [
    { id: 'assignment', kind: 'assignment' },
    { id: 'student-1', kind: 'student-submission' },
    { id: 'student-2', kind: 'student-submission' }
  ] as StoredMaterial[];
  const result = removeMaterialListById(current, 'student-submission', ['assignment', 'student-2']);
  assert.deepEqual(result.removed.map(asset => asset.id), ['student-2']);
  assert.deepEqual(result.remaining.map(asset => asset.id), ['assignment', 'student-1']);
});
