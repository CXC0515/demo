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
import { deleteReminder, deleteScheduleItem, listReminders, listScheduleItems, listSchedulePeriods, saveReminder, saveScheduleItem, saveScheduleItems, saveSchedulePeriods } from '../repositories/scheduleRepository';
import { importScheduleDocument } from '../services/schedule/scheduleImportService';

const router = Router();
const scheduleSchema = z.object({
  id: z.string().default(''), day: z.number().int().min(1).max(7), period: z.number().int().min(1).max(12),
  title: z.string().trim().min(1).max(120), classId: z.string().default(''), className: z.string().default(''),
  type: z.enum(['class', 'meeting', 'research', 'reminder', 'parent-comm', 'grading']), time: z.string().trim().min(1).max(80),
  scope: z.enum(['teacher', 'class']).default('teacher'), teacherName: z.string().max(80).optional(), confidence: z.number().min(0).max(1).optional()
});
const reminderSchema = z.object({
  id: z.string().default(''), name: z.string().trim().min(1).max(160), classId: z.string().default(''), className: z.string().default(''),
  time: z.string().trim().min(1).max(100), repeatRule: z.string().trim().min(1).max(80), status: z.enum(['active', 'inactive']),
  important: z.boolean().default(false), urgent: z.boolean().default(false), dueAt: z.string().max(40).optional()
});
const periodSchema = z.object({
  period: z.number().int().min(1).max(12), label: z.string().trim().min(1).max(30),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/)
}).refine(item => item.startTime < item.endTime, { message: 'PERIOD_END_MUST_FOLLOW_START' });

router.get('/schedule', (_request, response) => response.json({ schedule: listScheduleItems(), reminders: listReminders(), periods: listSchedulePeriods() }));
router.put('/schedule/periods', (request, response) => {
  const parsed = z.object({ periods: z.array(periodSchema).min(1).max(12) }).superRefine((value, context) => {
    if (new Set(value.periods.map(item => item.period)).size !== value.periods.length) context.addIssue({ code: 'custom', message: 'DUPLICATE_PERIOD' });
  }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_SCHEDULE_PERIODS', issues: parsed.error.issues }); return; }
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
