/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { accessSync, constants } from 'node:fs';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { getModelConfig, isModelConfigured } from './config/modelConfig';
import { getDocumentParserConfig, isPaddleCloudConfigured } from './config/documentParserConfig';
import { RuntimeConfig, runtimeConfig } from './config/runtimeConfig';
import { getRosterDatabase } from './database/rosterDatabase';
import { getResourceDatabase } from './database/resourceDatabase';
import { logEvent } from './observability/logger';
import gradingTasksRouter from './routes/gradingTasks';
import rosterRouter from './routes/roster';
import classroomRouter from './routes/classroom';
import gradingTaskManagementRouter from './routes/gradingTaskManagement';
import resourcesRouter from './routes/resources';
import scheduleRouter from './routes/schedule';

const readiness = (config: RuntimeConfig) => {
  accessSync(config.dataDirectory, constants.R_OK | constants.W_OK);
  accessSync(config.uploadDirectory, constants.R_OK | constants.W_OK);
  getRosterDatabase().prepare('SELECT 1').get();
  getResourceDatabase().prepare('SELECT 1').get();
  return {
    ok: true,
    storage: 'ready',
    multimodalConfigured: isModelConfigured(getModelConfig()),
    paddleCloudConfigured: isPaddleCloudConfigured(getDocumentParserConfig()),
  };
};

export const createApp = (config: RuntimeConfig = runtimeConfig) => {
  const app = express();
  app.disable('x-powered-by');
  if (config.production) app.set('trust proxy', 1);

  app.use((request, response, next) => {
    const requestId = request.header('x-request-id')?.slice(0, 128) || randomUUID();
    response.setHeader('x-request-id', requestId);
    const startedAt = performance.now();
    response.on('finish', () => {
      logEvent('info', 'http_request_completed', {
        requestId,
        method: request.method,
        route: typeof request.route?.path === 'string' ? request.route.path : 'unmatched',
        statusCode: response.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      });
    });
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(config.uploadDirectory, { index: false, fallthrough: false }));
  app.get('/api/health/live', (_request, response) => response.json({ ok: true }));
  app.get('/api/health/ready', (_request, response) => {
    try {
      response.json(readiness(config));
    } catch (error) {
      logEvent('error', 'readiness_check_failed', { error });
      response.status(503).json({ ok: false, code: 'SERVICE_NOT_READY' });
    }
  });
  app.get('/api/health', (_request, response) => {
    try {
      response.json(readiness(config));
    } catch (error) {
      logEvent('error', 'health_check_failed', { error });
      response.status(503).json({ ok: false, code: 'SERVICE_NOT_READY' });
    }
  });

  app.use('/api', rosterRouter);
  app.use('/api', classroomRouter);
  app.use('/api', gradingTaskManagementRouter);
  app.use('/api/grading-tasks', gradingTasksRouter);
  app.use('/api', resourcesRouter);
  app.use('/api', scheduleRouter);
  app.use('/api', (_request, response) => response.status(404).json({ code: 'API_NOT_FOUND' }));

  if (config.production) {
    app.use(express.static(config.distDirectory, { index: false, maxAge: '1h' }));
    app.get('*', (request, response, next) => {
      if (request.path.startsWith('/uploads/')) return next();
      response.sendFile(path.join(config.distDirectory, 'index.html'));
    });
  }

  app.use((_request, response) => response.status(404).json({ code: 'NOT_FOUND' }));
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const requestId = String(response.getHeader('x-request-id') ?? 'unknown');
    logEvent('error', 'unhandled_request_error', { requestId, error });
    if (!response.headersSent) response.status(500).json({ code: 'INTERNAL_SERVER_ERROR', requestId });
  });

  return app;
};
