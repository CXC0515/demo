/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import gradingTasksRouter from './routes/gradingTasks';
import rosterRouter from './routes/roster';
import classroomRouter from './routes/classroom';
import gradingTaskManagementRouter from './routes/gradingTaskManagement';
import resourcesRouter from './routes/resources';
import scheduleRouter from './routes/schedule';
import { getModelConfig, isModelConfigured } from './config/modelConfig';

const app = express();
const port = Number(process.env.API_PORT ?? 3001);
const uploadDirectory = path.resolve('var/uploads');
mkdirSync(uploadDirectory, { recursive: true });

app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDirectory, { index: false, fallthrough: false }));
app.get('/api/health', (_request, response) => response.json({ ok: true, multimodalConfigured: isModelConfigured(getModelConfig()) }));
app.use('/api', rosterRouter);
app.use('/api', classroomRouter);
app.use('/api', gradingTaskManagementRouter);
app.use('/api/grading-tasks', gradingTasksRouter);
app.use('/api', resourcesRouter);
app.use('/api', scheduleRouter);

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
