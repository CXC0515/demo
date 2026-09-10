import assert from 'node:assert/strict';
import test from 'node:test';
import { isScheduleTime, normalizeScheduleTime } from './scheduleTime';

test('normalizes compact and colon separated school times', () => {
  assert.equal(normalizeScheduleTime('0800'), '08:00');
  assert.equal(normalizeScheduleTime('800'), '08:00');
  assert.equal(normalizeScheduleTime('8:05'), '08:05');
  assert.equal(normalizeScheduleTime(' 18:30 '), '18:30');
});

test('rejects incomplete and invalid times', () => {
  assert.equal(normalizeScheduleTime('08'), null);
  assert.equal(normalizeScheduleTime('24:00'), null);
  assert.equal(normalizeScheduleTime('08:60'), null);
  assert.equal(normalizeScheduleTime('text'), null);
});

test('recognizes the canonical persisted format', () => {
  assert.equal(isScheduleTime('08:00'), true);
  assert.equal(isScheduleTime('8:00'), false);
});
