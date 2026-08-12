import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJson } from './extractJson';

test('extracts the first complete JSON value and ignores trailing model text', () => {
  assert.deepEqual(extractJson('{"items":[{"text":"brace } in string"}]}\n说明'), { items: [{ text: 'brace } in string' }] });
});

test('rejects incomplete JSON', () => assert.throws(() => extractJson('{"items":['), /MODEL_JSON_INCOMPLETE/));
