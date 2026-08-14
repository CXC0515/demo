/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { z } from 'zod';
import { listGradingTasks, saveGradingTask } from '../repositories/gradingTaskRepository';

const router = Router();
const taskSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), classId: z.string().min(1), className: z.string().min(1),
  node: z.enum(['setup', 'collection', 'upload', 'ocr', 'grading', 'verify', 'report', 'sync']),
  nodeName: z.string(), deadline: z.string(), createdAt: z.string(), collectionDeadlineAt: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'error']), progress: z.number().optional(),
  selectedQuestionIds: z.array(z.string().min(1)).optional(), questionScopeConfirmedAt: z.string().datetime().optional()
});

router.get('/grading-task-list', (_request, response) => response.json({ tasks: listGradingTasks() }));
router.put('/grading-task-list/:taskId', (request, response) => {
  const parsed = taskSchema.safeParse({ ...request.body, id: request.params.taskId });
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_GRADING_TASK' }); return; }
  response.json({ task: saveGradingTask(parsed.data) });
});

export default router;
