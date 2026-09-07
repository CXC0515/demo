/** @license SPDX-License-Identifier: Apache-2.0 */

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';
import Database from 'better-sqlite3';
import { createManagedProductSnapshot } from './productSnapshot';

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

const createFixture = async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'demo-product-snapshot-'));
  temporaryRoots.push(parent);
  const source = path.join(parent, 'source');
  const automatic = path.join(source, 'backups', 'automatic');
  await mkdir(path.join(source, 'system'), { recursive: true });
  await mkdir(path.join(source, 'workspaces', 'workspace-test', 'uploads'), { recursive: true });
  const auth = new Database(path.join(source, 'system', 'auth.sqlite'));
  auth.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('user-1')");
  auth.close();
  await writeFile(path.join(source, 'workspaces', 'workspace-test', 'uploads', 'resource.pdf'), 'first');
  return { source, automatic };
};

test('skips unchanged data and retains only the latest two successful snapshots', async () => {
  const { source, automatic } = await createFixture();
  const first = await createManagedProductSnapshot(source, automatic, 2, new Date('2026-09-08T01:00:00Z'));
  assert.equal(first.status, 'created');
  const duplicate = await createManagedProductSnapshot(source, automatic, 2, new Date('2026-09-08T02:00:00Z'));
  assert.equal(duplicate.status, 'skipped');

  const resource = path.join(source, 'workspaces', 'workspace-test', 'uploads', 'resource.pdf');
  await writeFile(resource, 'second');
  await createManagedProductSnapshot(source, automatic, 2, new Date('2026-09-08T03:00:00Z'));
  await writeFile(resource, 'third');
  const latest = await createManagedProductSnapshot(source, automatic, 2, new Date('2026-09-08T04:00:00Z'));
  assert.equal(latest.status, 'created');
  assert.equal(latest.pruned.length, 1);
  const entries = (await readdir(automatic)).filter(name => name.startsWith('product-'));
  assert.equal(entries.length, 2);
  assert.equal((await readdir(automatic)).some(name => name.startsWith('.pending-')), false);
});

test('keeps a failed snapshot under an incomplete name', async () => {
  const { source, automatic } = await createFixture();
  await symlink('/tmp', path.join(source, 'workspaces', 'workspace-test', 'unsafe-link'));
  await assert.rejects(
    () => createManagedProductSnapshot(source, automatic, 2, new Date('2026-09-08T05:00:00Z')),
    /SYMLINK_NOT_ALLOWED/,
  );
  assert.equal((await readdir(automatic)).some(name => name.startsWith('incomplete-')), true);
});

test('creates a new recovery point when an older snapshot is damaged', async () => {
  const { source, automatic } = await createFixture();
  const first = await createManagedProductSnapshot(source, automatic, 2, new Date('2026-09-08T01:00:00Z'));
  assert.equal(first.status, 'created');
  await writeFile(path.join(first.snapshotPath!, 'workspaces', 'workspace-test', 'uploads', 'resource.pdf'), 'damaged');

  const replacement = await createManagedProductSnapshot(source, automatic, 2, new Date('2026-09-08T02:00:00Z'));
  assert.equal(replacement.status, 'created');
  assert.equal((await readdir(automatic)).filter(name => name.startsWith('product-')).length, 2);
});
