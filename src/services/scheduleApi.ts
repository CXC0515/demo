/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReminderImportDraft, ScheduleItem, SchedulePeriod, TimerReminder } from '../domain/types';
import { apiFetch } from './apiClient';

const readError = async (response: Response) => ((await response.json().catch(() => ({}))) as { code?: string }).code ?? `HTTP_${response.status}`;
const jsonRequest = async <T>(url: string, init?: RequestInit) => {
  const response = await apiFetch(url, init);
  if (!response.ok) throw new Error(await readError(response));
  return response.status === 204 ? undefined as T : await response.json() as T;
};

export const getScheduleWorkspace = () => jsonRequest<{ schedule: ScheduleItem[]; reminders: TimerReminder[]; periods: SchedulePeriod[] }>('/api/schedule');
export const saveSchedulePeriods = (periods: SchedulePeriod[]) => jsonRequest<{ periods: SchedulePeriod[] }>('/api/schedule/periods', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periods }) }).then(body => body.periods);
export const saveScheduleItem = (item: ScheduleItem) => jsonRequest<{ item: ScheduleItem }>('/api/schedule/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }).then(body => body.item);
export const saveScheduleBatch = (items: ScheduleItem[]) => jsonRequest<{ items: ScheduleItem[] }>('/api/schedule/items/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) }).then(body => body.items);
export const removeScheduleItem = (id: string) => jsonRequest<void>(`/api/schedule/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const saveReminder = (reminder: TimerReminder) => jsonRequest<{ reminder: TimerReminder }>('/api/schedule/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reminder) }).then(body => body.reminder);
export const saveReminderSeries = (reminder: TimerReminder) => jsonRequest<{ reminders: TimerReminder[] }>(`/api/schedule/reminders/${reminder.id}/series`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reminder) }).then(body => body.reminders);
export const saveReminderBatch = (reminders: TimerReminder[]) => jsonRequest<{ reminders: TimerReminder[] }>('/api/schedule/reminders/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reminders }) }).then(body => body.reminders);
export const createReminderImportDraft = (text: string) => jsonRequest<{ drafts: ReminderImportDraft[]; warnings: string[] }>('/api/schedule/reminders/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
export const removeReminder = (id: string) => jsonRequest<void>(`/api/schedule/reminders/${encodeURIComponent(id)}`, { method: 'DELETE' });

export type ScheduleClassMatchReason = 'exact-name' | 'normalized-name' | 'grade-class-number' | 'ai-catalog-selection' | 'conflicting-evidence' | 'ambiguous-candidates' | 'no-candidate' | 'teacher-selected' | 'teacher-unassigned';
export interface ScheduleClassMatchDraft {
  status: 'matched' | 'unresolved' | 'unassigned';
  reason: ScheduleClassMatchReason;
  candidateClassIds: string[];
}
export interface ScheduleImportItemDraft extends ScheduleItem {
  recognizedClassText: string;
  classCorrectionType: 'exact' | 'format-normalized' | 'noise-removed' | 'ocr-corrected' | 'uncertain';
  classNeedsReview: boolean;
  classMatch: ScheduleClassMatchDraft;
}
export interface ScheduleImportDraft { items: ScheduleImportItemDraft[]; warnings: string[]; sourceText: string; timings?: { enhanceMs: number; paddleMs: number; aiMs: number; totalMs: number }; }
export const importSchedule = async (file: File, scope: 'teacher' | 'class', classId: string) => {
  const data = new FormData();
  data.append('file', file);
  data.append('scope', scope);
  data.append('classId', classId);
  const response = await apiFetch('/api/schedule/import', { method: 'POST', body: data });
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as ScheduleImportDraft;
};
