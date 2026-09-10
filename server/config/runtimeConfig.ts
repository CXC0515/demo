/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RESOURCE_UPLOAD_LIMIT_BYTES } from '../../src/domain/uploadPolicy';

export interface RuntimeConfig {
  nodeEnv: string;
  production: boolean;
  host: string;
  port: number;
  dataRoot: string;
  dataDirectory: string;
  uploadDirectory: string;
  backupDirectory: string;
  systemDirectory: string;
  workspacesDirectory: string;
  authDatabasePath: string;
  appUrl: string;
  authSecret: string;
  rosterDatabasePath: string;
  resourceDatabasePath: string;
  distDirectory: string;
  shutdownTimeoutMs: number;
  uploadLimits: {
    resourceFileBytes: number;
    gradingFileBytes: number;
    gradingFileCount: number;
    scheduleFileBytes: number;
  };
}

const MEBIBYTE = 1024 * 1024;

const positiveInteger = (value: string | undefined, fallback: number, name: string) => {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
};

const portNumber = (value: string | undefined) => {
  const parsed = positiveInteger(value, 3001, 'API_PORT');
  if (parsed > 65_535) throw new Error('API_PORT must be between 1 and 65535.');
  return parsed;
};

const resolved = (value: string | undefined, fallback: string, cwd: string) =>
  path.resolve(cwd, value?.trim() || fallback);

const assertSafeRoot = (target: string, cwd: string) => {
  if (target === path.parse(target).root) throw new Error('APP_DATA_ROOT cannot be the filesystem root.');
  if (target === path.resolve(cwd)) throw new Error('APP_DATA_ROOT cannot be the project root.');
};

export const loadRuntimeConfig = (
  environment: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): RuntimeConfig => {
  const nodeEnv = environment.NODE_ENV?.trim() || 'development';
  const production = nodeEnv === 'production';
  const dataRoot = resolved(environment.APP_DATA_ROOT, 'var', cwd);
  assertSafeRoot(dataRoot, cwd);
  const dataDirectory = path.join(dataRoot, 'data');
  const uploadDirectory = path.join(dataRoot, 'uploads');
  const backupDirectory = resolved(environment.APP_BACKUP_ROOT, path.join(dataRoot, 'backups'), cwd);
  const systemDirectory = path.join(dataRoot, 'system');
  const workspacesDirectory = path.join(dataRoot, 'workspaces');
  const appUrl = environment.APP_URL?.trim() || `http://localhost:${portNumber(environment.API_PORT)}`;
  const authSecret = environment.AUTH_SECRET?.trim() || (production ? '' : 'development-only-change-before-production-123456');
  if (production && authSecret.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters in production.');
  try {
    const parsedUrl = new URL(appUrl);
    if (production && parsedUrl.protocol !== 'https:') throw new Error('APP_URL must use HTTPS in production.');
  } catch (error) {
    if (error instanceof Error && error.message === 'APP_URL must use HTTPS in production.') throw error;
    throw new Error('APP_URL must be an absolute HTTP(S) URL.');
  }

  return {
    nodeEnv,
    production,
    host: environment.API_HOST?.trim() || '127.0.0.1',
    port: portNumber(environment.API_PORT),
    dataRoot,
    dataDirectory,
    uploadDirectory,
    backupDirectory,
    systemDirectory,
    workspacesDirectory,
    authDatabasePath: path.join(systemDirectory, 'auth.sqlite'),
    appUrl,
    authSecret,
    rosterDatabasePath: resolved(environment.ROSTER_DB_PATH, path.join(dataDirectory, 'roster.sqlite'), cwd),
    resourceDatabasePath: resolved(environment.RESOURCE_DB_PATH, path.join(dataDirectory, 'resources.sqlite'), cwd),
    distDirectory: resolved(environment.APP_DIST_DIR, 'dist', cwd),
    shutdownTimeoutMs: positiveInteger(environment.SHUTDOWN_TIMEOUT_MS, 15_000, 'SHUTDOWN_TIMEOUT_MS'),
    uploadLimits: {
      resourceFileBytes: RESOURCE_UPLOAD_LIMIT_BYTES,
      gradingFileBytes: 4 * MEBIBYTE,
      gradingFileCount: 20,
      scheduleFileBytes: 10 * MEBIBYTE,
    },
  };
};

export const runtimeConfig = loadRuntimeConfig();

export const ensureRuntimeDirectories = (config: RuntimeConfig = runtimeConfig) => {
  for (const directory of [config.dataRoot, config.systemDirectory, config.workspacesDirectory, config.backupDirectory]) {
    mkdirSync(directory, { recursive: true });
    accessSync(directory, constants.R_OK | constants.W_OK);
  }
};

export const assertProductionAssets = (config: RuntimeConfig = runtimeConfig) => {
  if (!config.production) return;
  if (!existsSync(path.join(config.distDirectory, 'index.html'))) {
    throw new Error(`Production frontend is missing: ${path.join(config.distDirectory, 'index.html')}`);
  }
};
