import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { createResourceDatabase } from '../database/resourceDatabase';
import { runResourceMigrations } from '../database/resourceMigrations';
import { ResourceRepository } from './resourceRepository';
import { MaterialPoolRepository } from './materialPoolRepository';

test('migration maps existing resource originals once without moving files', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'pool-migration-'));
  const file = path.join(root, 'existing.pdf');
  writeFileSync(file, '%PDF-1.4\n');
  const database = new Database(path.join(root, 'resources.sqlite'));
  try {
    database.pragma('foreign_keys = ON');
    database.exec(`
      CREATE TABLE resource_schema_version (version INTEGER PRIMARY KEY);
      INSERT INTO resource_schema_version (version) VALUES (8);
      CREATE TABLE resources (id TEXT PRIMARY KEY, file_name TEXT, mime_type TEXT, disk_path TEXT, created_at TEXT, updated_at TEXT);
      INSERT INTO resources VALUES ('legacy-1', 'existing.pdf', 'application/pdf', '${file}', '2026-01-01', '2026-01-01');
    `);
    runResourceMigrations(database);
    runResourceMigrations(database);
    const item = database.prepare('SELECT id, disk_path, source FROM pool_items WHERE id = ?').get('legacy-1') as { id: string; disk_path: string; source: string };
    assert.deepEqual(item, { id: 'legacy-1', disk_path: file, source: 'legacy-resource' });
    assert.equal((database.prepare('SELECT pool_item_id FROM resources WHERE id = ?').get('legacy-1') as { pool_item_id: string }).pool_item_id, 'legacy-1');
    assert.equal((database.prepare('SELECT COUNT(*) AS count FROM pool_items').get() as { count: number }).count, 1);
  } finally { database.close(); rmSync(root, { recursive: true, force: true }); }
});

test('folders, tags, reuse and referenced original protection share one database', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'pool-repository-'));
  const database = createResourceDatabase(path.join(root, 'resources.sqlite'));
  try {
    const pool = new MaterialPoolRepository(database);
    const resources = new ResourceRepository(database);
    const folder = pool.createFolder('备课', null);
    const item = pool.createItem({ id: randomUUID(), originalName: 'lesson.pdf', detectedMime: 'application/pdf', sizeBytes: 12, sha256: 'abc', diskPath: path.join(root, 'lesson.pdf'), source: 'upload' });
    assert.equal(pool.listItems({ folderId: null }).items.length, 1);
    assert.equal(pool.moveItem(item.id, folder.id)?.folderId, folder.id);
    assert.deepEqual(pool.setTags(item.id, ['七年级', '数学'])?.tags, ['七年级', '数学']);
    assert.equal(pool.listItems({ query: '数学' }).items[0]?.id, item.id);
    const resource = resources.createResource({
      id: randomUUID(), title: '教案', fileName: 'lesson.pdf', mimeType: 'application/pdf',
      kind: 'lesson-plan', subject: '', grade: '', publisher: '', edition: '', isPrimary: false,
      diskPath: path.join(root, 'lesson.pdf'), publicUrl: '/api/resources/example/content',
    }, item.id);
    assert.equal(pool.getItem(item.id)?.resourceId, resource.id);
    assert.throws(() => pool.setTrashed(item.id, true), /ITEM_IN_USE/);
    resources.deleteResource(resource.id);
    assert.equal(pool.setTrashed(item.id, true)?.state, 'trashed');
    assert.equal(pool.setTrashed(item.id, false)?.state, 'saved');
  } finally { database.close(); rmSync(root, { recursive: true, force: true }); }
});
