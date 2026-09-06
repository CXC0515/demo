/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';
import Database from 'better-sqlite3';
import { createAppDataSnapshot, restoreAppDataSnapshot, verifyAppData, verifySnapshot } from './dataSnapshot';

const temporaryRoots: string[] = [];
afterEach(() => {
  while (temporaryRoots.length) rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
});

const createFixture = async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'demo-app-data-'));
  temporaryRoots.push(root);
  await mkdir(path.join(root, 'data/parser-artifacts'), { recursive: true });
  await mkdir(path.join(root, 'uploads/resources'), { recursive: true });
  const resourceFile = path.join(root, 'uploads/resources/resource.pdf');
  await writeFile(resourceFile, 'fixture-pdf');
  await writeFile(path.join(root, 'data/grading-tasks.json'), JSON.stringify([{ diskPath: resourceFile }]));
  await writeFile(path.join(root, 'data/parser-artifacts/resource.json'), JSON.stringify({ sourcePath: resourceFile }));

  const roster = new Database(path.join(root, 'data/roster.sqlite'));
  roster.exec('CREATE TABLE classes (id TEXT); CREATE TABLE students (id TEXT); INSERT INTO classes VALUES (\'class-1\'); INSERT INTO students VALUES (\'student-1\');');
  roster.close();

  const resources = new Database(path.join(root, 'data/resources.sqlite'));
  resources.exec('CREATE TABLE resources (id TEXT PRIMARY KEY, disk_path TEXT NOT NULL); CREATE TABLE resource_pages (id TEXT); CREATE TABLE knowledge_nodes (id TEXT);');
  resources.prepare('INSERT INTO resources (id, disk_path) VALUES (?, ?)').run('resource-1', resourceFile);
  resources.close();
  return root;
};

test('creates an online SQLite and file snapshot, then restores to a new root', async () => {
  const source = await createFixture();
  const snapshot = `${source}-snapshot`;
  const restored = `${source}-restored`;
  temporaryRoots.push(snapshot, restored);
  const manifest = await createAppDataSnapshot(source, snapshot);
  assert.equal(manifest.verification.databases.every((database) => database.integrity === 'ok'), true);
  assert.equal((await verifySnapshot(snapshot)).formatVersion, 1);

  const report = await restoreAppDataSnapshot(snapshot, restored);
  assert.deepEqual(report.verification.missingReferencedFiles, []);
  const restoredDatabase = new Database(path.join(restored, 'data/resources.sqlite'), { readonly: true });
  const row = restoredDatabase.prepare('SELECT disk_path FROM resources WHERE id = ?').get('resource-1') as { disk_path: string };
  restoredDatabase.close();
  assert.equal(row.disk_path, path.join(restored, 'uploads/resources/resource.pdf'));
  assert.equal(JSON.parse(readFileSync(path.join(restored, 'data/grading-tasks.json'), 'utf8'))[0].diskPath, row.disk_path);
  assert.equal((await verifyAppData(restored)).databases[0].counts.classes, 1);
});

test('rejects a modified snapshot and refuses to overwrite a restore target', async () => {
  const source = await createFixture();
  const snapshot = `${source}-snapshot`;
  const restored = `${source}-restored`;
  temporaryRoots.push(snapshot, restored);
  await createAppDataSnapshot(source, snapshot);
  await mkdir(restored);
  await assert.rejects(() => restoreAppDataSnapshot(snapshot, restored), /TARGET_ALREADY_EXISTS/);
  writeFileSync(path.join(snapshot, 'uploads/resources/resource.pdf'), 'tampered');
  await assert.rejects(() => verifySnapshot(snapshot), /SNAPSHOT_FILE_MISMATCH/);
});

test('rejects snapshot and restore targets that could recursively copy themselves', async () => {
  const source = await createFixture();
  await assert.rejects(
    () => createAppDataSnapshot(source, path.join(source, 'uploads/unsafe-snapshot')),
    /SNAPSHOT_DESTINATION_INSIDE_SOURCE_DATA/,
  );

  const snapshot = `${source}-snapshot`;
  temporaryRoots.push(snapshot);
  await createAppDataSnapshot(source, snapshot);
  await assert.rejects(
    () => restoreAppDataSnapshot(snapshot, path.join(snapshot, 'unsafe-restore')),
    /RESTORE_TARGET_CANNOT_BE_INSIDE_SNAPSHOT/,
  );
});
