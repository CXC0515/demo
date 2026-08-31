/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { ScheduleItem, SchedulePeriod, TimerReminder } from '../../src/domain/types';
import { getRosterDatabase } from '../database/rosterDatabase';

const database = getRosterDatabase();
const now = () => new Date().toISOString();

interface ScheduleRow {
  id: string; day: number; period: number; title: string; class_id: string | null; class_name: string;
  item_type: ScheduleItem['type']; time_text: string; scope: 'teacher' | 'class'; teacher_name: string; confidence: number | null;
}
interface ReminderRow {
  id: string; name: string; class_id: string | null; class_name: string; time_text: string; repeat_rule: string;
  status: TimerReminder['status']; important: number; urgent: number; due_at: string | null;
}
interface PeriodRow { period: number; label: string; start_time: string; end_time: string; }

const toSchedule = (row: ScheduleRow): ScheduleItem => ({
  id: row.id, day: row.day, period: row.period, title: row.title, classId: row.class_id ?? '', className: row.class_name,
  type: row.item_type, time: row.time_text, scope: row.scope, teacherName: row.teacher_name, confidence: row.confidence ?? undefined
});
const toReminder = (row: ReminderRow): TimerReminder => ({
  id: row.id, name: row.name, classId: row.class_id ?? '', className: row.class_name, time: row.time_text,
  repeatRule: row.repeat_rule, status: row.status, important: Boolean(row.important), urgent: Boolean(row.urgent), dueAt: row.due_at ?? undefined
});

export const listScheduleItems = () => (database.prepare('SELECT * FROM schedule_items ORDER BY day, period, created_at').all() as ScheduleRow[]).map(toSchedule);
export const listReminders = () => (database.prepare('SELECT * FROM timer_reminders ORDER BY status, COALESCE(due_at, updated_at), created_at').all() as ReminderRow[]).map(toReminder);
export const listSchedulePeriods = (): SchedulePeriod[] => (database.prepare('SELECT * FROM schedule_periods ORDER BY period').all() as PeriodRow[]).map(row => ({ period: row.period, label: row.label, startTime: row.start_time, endTime: row.end_time }));

export const saveSchedulePeriods = (periods: SchedulePeriod[]) => database.transaction(() => {
  database.prepare('DELETE FROM schedule_periods').run();
  const statement = database.prepare(`
    INSERT INTO schedule_periods (period, label, start_time, end_time, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(period) DO UPDATE SET label=excluded.label, start_time=excluded.start_time, end_time=excluded.end_time, updated_at=excluded.updated_at
  `);
  const timestamp = now();
  periods.forEach(item => statement.run(item.period, item.label, item.startTime, item.endTime, timestamp));
  return listSchedulePeriods();
})();

export const saveScheduleItem = (input: ScheduleItem): ScheduleItem => {
  const id = input.id || randomUUID();
  const timestamp = now();
  database.prepare(`
    INSERT INTO schedule_items (id, day, period, title, class_id, class_name, item_type, time_text, scope, teacher_name, confidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET day=excluded.day, period=excluded.period, title=excluded.title, class_id=excluded.class_id,
      class_name=excluded.class_name, item_type=excluded.item_type, time_text=excluded.time_text, scope=excluded.scope,
      teacher_name=excluded.teacher_name, confidence=excluded.confidence, updated_at=excluded.updated_at
  `).run(id, input.day, input.period, input.title, input.classId, input.className, input.type, input.time,
    input.scope ?? 'teacher', input.teacherName ?? '', input.confidence ?? null, timestamp, timestamp);
  return toSchedule(database.prepare('SELECT * FROM schedule_items WHERE id = ?').get(id) as ScheduleRow);
};

export const saveScheduleItems = (items: ScheduleItem[]) => database.transaction(() => items.map(saveScheduleItem))();
export const deleteScheduleItem = (id: string) => database.prepare('DELETE FROM schedule_items WHERE id = ?').run(id).changes > 0;

export const saveReminder = (input: TimerReminder): TimerReminder => {
  const id = input.id || randomUUID();
  const timestamp = now();
  database.prepare(`
    INSERT INTO timer_reminders (id, name, class_id, class_name, time_text, repeat_rule, status, important, urgent, due_at, created_at, updated_at)
    VALUES (?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, class_id=excluded.class_id, class_name=excluded.class_name,
      time_text=excluded.time_text, repeat_rule=excluded.repeat_rule, status=excluded.status, important=excluded.important,
      urgent=excluded.urgent, due_at=excluded.due_at, updated_at=excluded.updated_at
  `).run(id, input.name, input.classId, input.className, input.time, input.repeatRule, input.status,
    input.important ? 1 : 0, input.urgent ? 1 : 0, input.dueAt ?? '', timestamp, timestamp);
  return toReminder(database.prepare('SELECT * FROM timer_reminders WHERE id = ?').get(id) as ReminderRow);
};

export const deleteReminder = (id: string) => database.prepare('DELETE FROM timer_reminders WHERE id = ?').run(id).changes > 0;
