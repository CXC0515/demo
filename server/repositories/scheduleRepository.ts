/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { ReminderRecurrence, ScheduleItem, SchedulePeriod, TimerReminder } from '../../src/domain/types';
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
  time_kind: NonNullable<TimerReminder['timeKind']>; start_at: string | null; end_at: string | null;
  completed_at: string | null; sort_order: number; assumption_warning: string; recurrence_json: string | null;
  series_id: string | null; occurrence_number: number; generated_from_id: string | null;
}
interface PeriodRow { period: number; label: string; start_time: string; end_time: string; }

const toSchedule = (row: ScheduleRow): ScheduleItem => ({
  id: row.id, day: row.day, period: row.period, title: row.title, classId: row.class_id ?? '', className: row.class_name,
  type: row.item_type, time: row.time_text, scope: row.scope, teacherName: row.teacher_name, confidence: row.confidence ?? undefined
});
const toReminder = (row: ReminderRow): TimerReminder => ({
  id: row.id, name: row.name, classId: row.class_id ?? '', className: row.class_name, time: row.time_text,
  repeatRule: row.repeat_rule, status: row.status, important: Boolean(row.important), urgent: Boolean(row.urgent),
  dueAt: row.due_at ?? undefined, timeKind: row.time_kind, startAt: row.start_at ?? undefined, endAt: row.end_at ?? undefined,
  completedAt: row.completed_at ?? undefined, sortOrder: row.sort_order, assumptionWarning: row.assumption_warning || undefined,
  recurrence: row.recurrence_json ? JSON.parse(row.recurrence_json) as ReminderRecurrence : undefined,
  seriesId: row.series_id ?? undefined, occurrenceNumber: row.occurrence_number, generatedFromId: row.generated_from_id ?? undefined
});

export const listScheduleItems = () => (database.prepare('SELECT * FROM schedule_items ORDER BY day, period, created_at').all() as ScheduleRow[]).map(toSchedule);
export const listReminders = () => (database.prepare("SELECT * FROM timer_reminders ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END, important DESC, urgent DESC, sort_order, COALESCE(due_at, updated_at), created_at").all() as ReminderRow[]).map(toReminder);
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

const parseLocal = (value: string) => {
  const [datePart, timePart = '00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
};
const formatLocal = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
const addMonthsClamped = (date: Date, months: number, preferredDay = date.getUTCDate()) => {
  const result = new Date(date);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(preferredDay === 0 ? lastDay : Math.min(preferredDay, lastDay));
  return result;
};
const nextOccurrenceStart = (startAt: string, recurrence: ReminderRecurrence) => {
  const current = parseLocal(startAt);
  const interval = Math.max(1, recurrence.interval || 1);
  if (recurrence.unit === 'day') current.setUTCDate(current.getUTCDate() + interval);
  else if (recurrence.unit === 'year') current.setUTCFullYear(current.getUTCFullYear() + interval);
  else if (recurrence.unit === 'month') {
    const preferred = recurrence.monthDays?.[0] ?? current.getUTCDate();
    return formatLocal(addMonthsClamped(current, interval, preferred));
  } else {
    const weekdays = [...new Set(recurrence.weekdays?.filter(day => day >= 1 && day <= 7) ?? [])].sort();
    if (!weekdays.length) current.setUTCDate(current.getUTCDate() + 7 * interval);
    else {
      const currentWeekday = current.getUTCDay() || 7;
      const nextDay = weekdays.find(day => day > currentWeekday);
      current.setUTCDate(current.getUTCDate() + (nextDay ? nextDay - currentWeekday : 7 * interval - currentWeekday + weekdays[0]));
    }
  }
  return formatLocal(current);
};
const displayReminderTime = (kind: TimerReminder['timeKind'], startAt?: string, endAt?: string) => kind === 'none' || !startAt
  ? '时间待定'
  : kind === 'range' && endAt ? `${startAt.replace('T', ' ')} - ${endAt.replace('T', ' ')}` : startAt.replace('T', ' ');

const saveReminderRecord = (input: TimerReminder): TimerReminder => {
  const id = input.id || randomUUID();
  const timestamp = now();
  database.prepare(`
    INSERT INTO timer_reminders (id, name, class_id, class_name, time_text, repeat_rule, status, important, urgent, due_at, time_kind, start_at, end_at, completed_at, sort_order, assumption_warning, recurrence_json, series_id, occurrence_number, generated_from_id, created_at, updated_at)
    VALUES (?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, NULLIF(?, ''), ?, NULLIF(?, ''), ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, class_id=excluded.class_id, class_name=excluded.class_name,
      time_text=excluded.time_text, repeat_rule=excluded.repeat_rule, status=excluded.status, important=excluded.important,
      urgent=excluded.urgent, due_at=excluded.due_at, time_kind=excluded.time_kind, start_at=excluded.start_at,
      end_at=excluded.end_at, completed_at=excluded.completed_at, sort_order=excluded.sort_order,
      assumption_warning=excluded.assumption_warning, recurrence_json=excluded.recurrence_json, series_id=excluded.series_id,
      occurrence_number=excluded.occurrence_number, generated_from_id=excluded.generated_from_id, updated_at=excluded.updated_at
  `).run(id, input.name, input.classId, input.className, input.time, input.repeatRule, input.status,
    input.important ? 1 : 0, input.urgent ? 1 : 0, input.dueAt ?? input.startAt ?? '', input.timeKind ?? (input.startAt || input.dueAt ? 'point' : 'none'),
    input.startAt ?? input.dueAt ?? '', input.endAt ?? '', input.completedAt ?? '', input.sortOrder ?? 0,
    input.assumptionWarning ?? '', input.recurrence?.enabled ? JSON.stringify(input.recurrence) : null,
    input.seriesId ?? (input.recurrence?.enabled ? id : ''), input.occurrenceNumber ?? 1, input.generatedFromId ?? '', timestamp, timestamp);
  return toReminder(database.prepare('SELECT * FROM timer_reminders WHERE id = ?').get(id) as ReminderRow);
};

export const saveReminder = (input: TimerReminder): TimerReminder => database.transaction(() => {
  const existingRow = input.id ? database.prepare('SELECT * FROM timer_reminders WHERE id = ?').get(input.id) as ReminderRow | undefined : undefined;
  const existing = existingRow ? toReminder(existingRow) : undefined;
  const completing = existing?.status === 'active' && input.status === 'completed';
  const reopening = existing?.status === 'completed' && input.status === 'active';
  const saved = saveReminderRecord({ ...input, completedAt: input.status === 'completed' ? input.completedAt ?? now() : undefined });
  if (reopening) database.prepare("DELETE FROM timer_reminders WHERE generated_from_id = ? AND status = 'active'").run(saved.id);
  if (completing && saved.recurrence?.enabled && saved.startAt) {
    const nextNumber = (saved.occurrenceNumber ?? 1) + 1;
    const nextStart = nextOccurrenceStart(saved.startAt, saved.recurrence);
    const withinCount = !saved.recurrence.maxOccurrences || nextNumber <= saved.recurrence.maxOccurrences;
    const withinDate = !saved.recurrence.endDate || nextStart.slice(0, 10) <= saved.recurrence.endDate;
    if (withinCount && withinDate) {
      const duration = saved.endAt ? parseLocal(saved.endAt).getTime() - parseLocal(saved.startAt).getTime() : 0;
      const nextEnd = saved.endAt ? formatLocal(new Date(parseLocal(nextStart).getTime() + duration)) : undefined;
      saveReminderRecord({ ...saved, id: randomUUID(), status: 'active', completedAt: undefined, startAt: nextStart,
        endAt: nextEnd, dueAt: nextStart, time: displayReminderTime(saved.timeKind, nextStart, nextEnd),
        occurrenceNumber: nextNumber, generatedFromId: saved.id, assumptionWarning: undefined });
    }
  }
  return saved;
})();

export const saveReminders = (items: TimerReminder[]) => database.transaction(() => items.map(saveReminder))();

export const deleteReminder = (id: string) => database.prepare('DELETE FROM timer_reminders WHERE id = ?').run(id).changes > 0;
