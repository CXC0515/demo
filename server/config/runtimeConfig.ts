/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export interface RuntimeConfig {
  nodeEnv: string;
  production: boolean;
  host: string;
  port: number;
  dataRoot: string;
  dataDirectory: string;
  uploadDirectory: string;
  backupDirectory: string;
  rosterDatabasePath: string;
  resourceDatabasePath: string;
  distDirectory: string;
  shutdownTimeoutMs: number;
}

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

  return {
    nodeEnv,
    production,
    host: environment.API_HOST?.trim() || '127.0.0.1',
    port: portNumber(environment.API_PORT),
    dataRoot,
    dataDirectory,
    uploadDirectory,
    backupDirectory,
    rosterDatabasePath: resolved(environment.ROSTER_DB_PATH, path.join(dataDirectory, 'roster.sqlite'), cwd),
    resourceDatabasePath: resolved(environment.RESOURCE_DB_PATH, path.join(dataDirectory, 'resources.sqlite'), cwd),
    distDirectory: resolved(environment.APP_DIST_DIR, 'dist', cwd),
    shutdownTimeoutMs: positiveInteger(environment.SHUTDOWN_TIMEOUT_MS, 15_000, 'SHUTDOWN_TIMEOUT_MS'),
  };
};

export const runtimeConfig = loadRuntimeConfig();

export const ensureRuntimeDirectories = (config: RuntimeConfig = runtimeConfig) => {
  for (const directory of [config.dataRoot, config.dataDirectory, config.uploadDirectory, config.backupDirectory]) {
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

export const dataFilePath = (...segments: string[]) => path.join(runtimeConfig.dataDirectory, ...segments);
export const uploadFilePath = (...segments: string[]) => path.join(runtimeConfig.uploadDirectory, ...segments);
