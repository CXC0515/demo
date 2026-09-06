/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import { assertProductionAssets, ensureRuntimeDirectories, runtimeConfig } from './config/runtimeConfig';
import { logEvent } from './observability/logger';

ensureRuntimeDirectories();
assertProductionAssets();

const { createApp } = await import('./app');
const { closeRosterDatabase } = await import('./database/rosterDatabase');
const { closeResourceDatabase } = await import('./database/resourceDatabase');
const { resourceRepository } = await import('./repositories/resourceRepository');

resourceRepository.markRunningJobsInterrupted();
const app = createApp();
const server = app.listen(runtimeConfig.port, runtimeConfig.host, () => {
  logEvent('info', 'server_started', {
    host: runtimeConfig.host,
    port: runtimeConfig.port,
    nodeEnv: runtimeConfig.nodeEnv,
  });
});

let shuttingDown = false;
const shutdown = (reason: string, exitCode: number) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logEvent('info', 'server_shutdown_started', { reason });
  const forceTimer = setTimeout(() => {
    logEvent('error', 'server_shutdown_forced', { reason, timeoutMs: runtimeConfig.shutdownTimeoutMs });
    server.closeAllConnections();
    process.exit(exitCode || 1);
  }, runtimeConfig.shutdownTimeoutMs);
  forceTimer.unref();
  server.close(() => {
    clearTimeout(forceTimer);
    closeRosterDatabase();
    closeResourceDatabase();
    logEvent('info', 'server_shutdown_completed', { reason });
    process.exit(exitCode);
  });
  server.closeIdleConnections();
};

process.once('SIGINT', () => shutdown('SIGINT', 0));
process.once('SIGTERM', () => shutdown('SIGTERM', 0));
process.once('uncaughtException', (error) => {
  logEvent('error', 'uncaught_exception', { error });
  shutdown('uncaughtException', 1);
});
process.once('unhandledRejection', (error) => {
  logEvent('error', 'unhandled_rejection', { error });
  shutdown('unhandledRejection', 1);
});
