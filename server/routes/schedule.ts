/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { deleteReminder, deleteScheduleItem, listReminders, listScheduleItems, listSchedulePeriods, saveReminder, saveReminderSeries, saveReminders, saveScheduleItem, saveScheduleItems, saveSchedulePeriods } from '../repositories/scheduleRepository';
import { importScheduleDocument } from '../services/schedule/scheduleImportService';
import { createReminderDrafts } from '../services/schedule/reminderImportService';

const router = Router();
const scheduleSchema = z.object({
  id: z.string().default(''), day: z.number().int().min(1).max(7), period: z.number().int().min(1).max(12),
  title: z.string().trim().min(1).max(120), classId: z.string().default(''), className: z.string().default(''),
  type: z.enum(['class', 'meeting', 'research', 'reminder', 'parent-comm', 'grading']), time: z.string().trim().min(1).max(80),
  scope: z.enum(['teacher', 'class']).default('teacher'), teacherName: z.string().max(80).optional(), confidence: z.number().min(0).max(1).optional()
});
const reminderSchema = z.object({
  id: z.string().default(''), name: z.string().trim().min(1).max(160), classId: z.string().default(''), className: z.string().default(''),
  time: z.string().trim().min(1).max(100), repeatRule: z.string().trim().min(1).max(80), status: z.enum(['active', 'completed', 'inactive']),
  important: z.boolean().default(false), urgent: z.boolean().default(false), dueAt: z.string().max(40).optional(),
  timeKind: z.enum(['none', 'point', 'range']).default('none'), startAt: z.string().max(40).optional(), endAt: z.string().max(40).optional(),
  completedAt: z.string().max(40).optional(), sortOrder: z.number().int().min(0).default(0), assumptionWarning: z.string().max(200).optional(),
  seriesId: z.string().max(80).optional(), occurrenceNumber: z.number().int().min(1).default(1), generatedFromId: z.string().max(80).optional(),
  recurrence: z.object({
    enabled: z.boolean(), unit: z.enum(['day', 'week', 'month', 'year']), interval: z.number().int().min(1).max(365),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(), monthDays: z.array(z.number().int().min(0).max(31)).max(32).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), maxOccurrences: z.number().int().min(1).max(999).optional()
  }).optional()
}).superRefine((item, context) => {
  if (item.timeKind === 'point' && !item.startAt) context.addIssue({ code: 'custom', message: 'REMINDER_POINT_REQUIRES_START' });
  if (item.timeKind === 'range' && (!item.startAt || !item.endAt || item.endAt <= item.startAt)) context.addIssue({ code: 'custom', message: 'REMINDER_RANGE_INVALID' });
});
const periodSchema = z.object({
  period: z.number().int().min(1).max(12), label: z.string().trim().min(1).max(30),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/)
}).refine(item => item.startTime < item.endTime, { message: 'PERIOD_END_MUST_FOLLOW_START' });

router.get('/schedule', (_request, response) => response.json({ schedule: listScheduleItems(), reminders: listReminders(), periods: listSchedulePeriods() }));
router.put('/schedule/periods', (request, response) => {
  const parsed = z.object({ periods: z.array(periodSchema).min(1).max(12) }).superRefine((value, context) => {
    if (new Set(value.periods.map(item => item.period)).size !== value.periods.length) context.addIssue({ code: 'custom', message: 'DUPLICATE_PERIOD' });
    if (value.periods.some((item, index) => item.period !== index + 1)) context.addIssue({ code: 'custom', message: 'PERIODS_MUST_BE_CONTIGUOUS' });
  }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_SCHEDULE_PERIODS', issues: parsed.error.issues }); return; }
  const allowedPeriods = new Set(parsed.data.periods.map(item => item.period));
  if (listScheduleItems().some(item => !allowedPeriods.has(item.period))) {
    response.status(409).json({ code: 'SCHEDULE_PERIOD_IN_USE' });
    return;
  }
  response.json({ periods: saveSchedulePeriods(parsed.data.periods) });
});
router.post('/schedule/items', (request, response) => {
  const parsed = scheduleSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_SCHEDULE_ITEM', issues: parsed.error.issues }); return; }
  response.status(parsed.data.id ? 200 : 201).json({ item: saveScheduleItem(parsed.data) });
});
router.post('/schedule/items/batch', (request, response) => {
  const parsed = z.object({ items: z.array(scheduleSchema).min(1).max(200) }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_SCHEDULE_BATCH', issues: parsed.error.issues }); return; }
  response.status(201).json({ items: saveScheduleItems(parsed.data.items) });
});
router.delete('/schedule/items/:id', (request, response) => {
  if (!deleteScheduleItem(request.params.id)) { response.status(404).json({ code: 'SCHEDULE_ITEM_NOT_FOUND' }); return; }
  response.status(204).end();
});
router.post('/schedule/reminders', (request, response) => {
  const parsed = reminderSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_REMINDER', issues: parsed.error.issues }); return; }
  response.status(parsed.data.id ? 200 : 201).json({ reminder: saveReminder(parsed.data) });
});
router.post('/schedule/reminders/batch', (request, response) => {
  const parsed = z.object({ reminders: z.array(reminderSchema).min(1).max(50) }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_REMINDER_BATCH', issues: parsed.error.issues }); return; }
  response.status(201).json({ reminders: saveReminders(parsed.data.reminders) });
});
router.put('/schedule/reminders/:id/series', (request, response) => {
  const parsed = reminderSchema.safeParse({ ...request.body, id: request.params.id });
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_REMINDER', issues: parsed.error.issues }); return; }
  try {
    response.json({ reminders: saveReminderSeries(parsed.data) });
  } catch (error) {
    response.status(404).json({ code: error instanceof Error ? error.message : 'REMINDER_NOT_FOUND' });
  }
});
router.post('/schedule/reminders/draft', async (request, response) => {
  const parsed = z.object({ text: z.string().trim().min(1).max(20000) }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_REMINDER_SOURCE', issues: parsed.error.issues }); return; }
  try {
    response.json(await createReminderDrafts(parsed.data.text));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'REMINDER_DRAFT_FAILED';
    response.status(code.includes('NOT_CONFIGURED') ? 503 : 422).json({ code });
  }
});
router.delete('/schedule/reminders/:id', (request, response) => {
  if (!deleteReminder(request.params.id)) { response.status(404).json({ code: 'REMINDER_NOT_FOUND' }); return; }
  response.status(204).end();
});

const uploadDirectory = path.resolve('var/uploads/schedule');
mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'))
});
router.post('/schedule/import', upload.single('file'), async (request, response) => {
  const file = request.file;
  const scope = request.body.scope === 'class' ? 'class' : 'teacher';
  if (!file) { response.status(400).json({ code: 'SCHEDULE_FILE_REQUIRED' }); return; }
  try {
    const result = await importScheduleDocument({
      assetId: randomUUID(), fileName: file.originalname, mimeType: file.mimetype, filePath: file.path,
      scope, classId: typeof request.body.classId === 'string' ? request.body.classId : ''
    });
    response.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SCHEDULE_IMPORT_FAILED';
    response.status(code.includes('NOT_CONFIGURED') ? 503 : 422).json({ code });
  } finally {
    rmSync(file.path, { force: true });
  }
});

export default router;
