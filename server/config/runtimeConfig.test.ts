/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadRuntimeConfig } from './runtimeConfig';

test('derives every default writable path from APP_DATA_ROOT', () => {
  const cwd = '/tmp/demo-runtime-config';
  const config = loadRuntimeConfig({ APP_DATA_ROOT: 'state', NODE_ENV: 'production' }, cwd);
  assert.equal(config.dataRoot, path.join(cwd, 'state'));
  assert.equal(config.rosterDatabasePath, path.join(cwd, 'state/data/roster.sqlite'));
  assert.equal(config.resourceDatabasePath, path.join(cwd, 'state/data/resources.sqlite'));
  assert.equal(config.uploadDirectory, path.join(cwd, 'state/uploads'));
  assert.equal(config.backupDirectory, path.join(cwd, 'state/backups'));
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.production, true);
});

test('accepts explicit database and operational paths', () => {
  const config = loadRuntimeConfig({
    APP_DATA_ROOT: '/srv/demo',
    APP_BACKUP_ROOT: '/srv/backups',
    APP_DIST_DIR: '/srv/app/dist',
    ROSTER_DB_PATH: '/srv/demo/custom/roster.sqlite',
    RESOURCE_DB_PATH: '/srv/demo/custom/resources.sqlite',
    API_HOST: '0.0.0.0',
    API_PORT: '8080',
    SHUTDOWN_TIMEOUT_MS: '20000',
  }, '/srv/app');
  assert.equal(config.backupDirectory, '/srv/backups');
  assert.equal(config.rosterDatabasePath, '/srv/demo/custom/roster.sqlite');
  assert.equal(config.resourceDatabasePath, '/srv/demo/custom/resources.sqlite');
  assert.equal(config.distDirectory, '/srv/app/dist');
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 8080);
  assert.equal(config.shutdownTimeoutMs, 20_000);
});

test('rejects unsafe roots and invalid ports', () => {
  assert.throws(() => loadRuntimeConfig({ APP_DATA_ROOT: '/' }, '/srv/app'), /filesystem root/);
  assert.throws(() => loadRuntimeConfig({ APP_DATA_ROOT: '/srv/app' }, '/srv/app'), /project root/);
  assert.throws(() => loadRuntimeConfig({ API_PORT: '70000' }, '/srv/app'), /between 1 and 65535/);
});
