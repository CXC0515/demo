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
const { closeRosterDatabase } = await import('../database/rosterDatabase');
after(() => { closeRosterDatabase(); rmSync(directory, { recursive: true, force: true }); });

test('persists schedules and reminder quadrant fields', () => {
  repository.saveScheduleItem({ id: 'schedule-1', day: 6, period: 1, title: '周末社团', classId: 'c5', className: '七年级 5 班', type: 'class', time: '08:00', scope: 'class', teacherName: '王老师' });
  repository.saveReminder({ id: 'reminder-1', name: '提交教案', classId: 'c5', className: '七年级 5 班', time: '周五 17:00', repeatRule: '一次性', status: 'active', important: true, urgent: false, dueAt: '2026-09-04T17:00' });
  assert.equal(repository.listScheduleItems()[0].day, 6);
  assert.equal(repository.listReminders()[0].important, true);
  assert.equal(repository.listReminders()[0].urgent, false);
});

test('persists the school-wide period timetable', () => {
  assert.equal(repository.listSchedulePeriods()[0].startTime, '08:00');
  const saved = repository.saveSchedulePeriods([{ period: 1, label: '早读', startTime: '07:40', endTime: '08:20' }]);
  assert.deepEqual(saved[0], { period: 1, label: '早读', startTime: '07:40', endTime: '08:20' });
});
