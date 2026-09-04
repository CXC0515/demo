/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'demo-schedule-repository-'));
process.env.ROSTER_DB_PATH = path.join(directory, 'roster.sqlite');
const repository = await import('./scheduleRepository');
const roster = await import('./rosterRepository');
const { closeRosterDatabase } = await import('../database/rosterDatabase');
const primaryClass = roster.createClass({ name: '七年级 5 班', grade: '七年级', term: '2026 秋季学期', headTeacher: '测试教师', chineseTeacher: '测试教师', status: 'active' });
after(() => { closeRosterDatabase(); rmSync(directory, { recursive: true, force: true }); });

test('persists schedules and reminder quadrant fields', () => {
  repository.saveScheduleItem({ id: 'schedule-1', day: 6, period: 1, title: '周末社团', classId: primaryClass.id, className: primaryClass.name, type: 'class', time: '08:00', scope: 'class', teacherName: '王老师' });
  repository.saveReminder({ id: 'reminder-1', name: '提交教案', classId: primaryClass.id, className: primaryClass.name, time: '周五 17:00', repeatRule: '一次性', status: 'active', important: true, urgent: false, timeKind: 'point', startAt: '2026-09-04T17:00' });
  assert.equal(repository.listScheduleItems()[0].day, 6);
  assert.equal(repository.listReminders()[0].important, true);
  assert.equal(repository.listReminders()[0].urgent, false);
  assert.equal(repository.listReminders()[0].timeKind, 'point');
  assert.equal(repository.listReminders()[0].startAt, '2026-09-04T17:00');
});

test('saves reminder batches transactionally', () => {
  const saved = repository.saveReminders([
    { id: 'reminder-2', name: '无时间事项', classId: '', className: '', time: '时间待定', repeatRule: '一次性', status: 'active', timeKind: 'none' },
    { id: 'reminder-3', name: '家长会', classId: primaryClass.id, className: primaryClass.name, time: '09:00 - 10:00', repeatRule: '一次性', status: 'active', timeKind: 'range', startAt: '2026-09-05T09:00', endAt: '2026-09-05T10:00' }
  ]);
  assert.equal(saved.length, 2);
  assert.equal(saved[1].timeKind, 'range');
});

test('completing a recurring event creates the next occurrence and reopening removes it', () => {
  const original = repository.saveReminder({ id: 'recurring-1', name: '周会', classId: '', className: '', time: '2026-09-07 14:00 - 15:00', repeatRule: '每 周', status: 'active', timeKind: 'range', startAt: '2026-09-07T14:00', endAt: '2026-09-07T15:00', recurrence: { enabled: true, unit: 'week', interval: 1, weekdays: [1], maxOccurrences: 3 } });
  repository.saveReminder({ ...original, status: 'completed' });
  const generated = repository.listReminders().find(item => item.generatedFromId === original.id);
  assert.equal(generated?.startAt, '2026-09-14T14:00');
  assert.equal(generated?.occurrenceNumber, 2);
  repository.saveReminder({ ...original, status: 'active' });
  assert.equal(repository.listReminders().some(item => item.generatedFromId === original.id), false);
});

test('persists the school-wide period timetable', () => {
  assert.equal(repository.listSchedulePeriods()[0].startTime, '08:00');
  repository.saveSchedulePeriods([
    { period: 1, label: '早读', startTime: '07:40', endTime: '08:20' },
    { period: 2, label: '第一节', startTime: '08:30', endTime: '09:15' }
  ]);
  const saved = repository.saveSchedulePeriods([{ period: 1, label: '早读', startTime: '07:40', endTime: '08:20' }]);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], { period: 1, label: '早读', startTime: '07:40', endTime: '08:20' });
});
