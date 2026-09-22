import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { PDFDocument } from 'pdf-lib';

test('uploading a pool PDF, reusing it and deleting the resource keeps one original', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'pool-http-'));
  const previousDataRoot = process.env.APP_DATA_ROOT;
  process.env.APP_DATA_ROOT = path.join(root, 'app-state');
  const [{ bindAuthenticatedWorkspace }, { createWorkspaceContext, runWithWorkspace }, { closeResourceDatabase }, { default: materialPoolRouter }, { default: resourcesRouter }] = await Promise.all([
    import('../middleware/authenticated'), import('../context/workspaceContext'), import('../database/resourceDatabase'), import('./materialPool'), import('./resources'),
  ]);
  const workspace = createWorkspaceContext('test-user', 'workspace-test-123', 'owner');
  workspace.root = root;
  workspace.dataDirectory = path.join(root, 'data');
  workspace.uploadDirectory = path.join(root, 'uploads');
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    bindAuthenticatedWorkspace(request, workspace);
    runWithWorkspace(workspace, () => next());
  });
  app.use('/api', materialPoolRouter, resourcesRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 300]);
    const bytes = await pdf.save();
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), 'lesson.pdf');
    const upload = await fetch(`${base}/api/material-pool/items`, { method: 'POST', body: form });
    assert.equal(upload.status, 201);
    const { item } = await upload.json() as { item: { id: string; contentUrl: string } };
    assert.ok(item.id);
    assert.equal((await fetch(`${base}${item.contentUrl}`)).status, 200);

    const metadata = { poolItemId: item.id, title: '示例教案', kind: 'lesson-plan', subject: '数学', grade: '七年级', publisher: '', edition: '', isPrimary: false };
    const selected = await fetch(`${base}/api/resources/from-pool`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) });
    assert.equal(selected.status, 201);
    const { resource } = await selected.json() as { resource: { id: string; poolItemId: string } };
    assert.equal(resource.poolItemId, item.id);
    const repeated = await fetch(`${base}/api/resources/from-pool`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) });
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json() as { resource: { id: string } }).resource.id, resource.id);
    assert.equal((await fetch(`${base}/api/material-pool/items/${item.id}/trash`, { method: 'POST' })).status, 409);
    assert.equal((await fetch(`${base}/api/resources/${resource.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${base}${item.contentUrl}`)).status, 200);
    assert.equal((await fetch(`${base}/api/material-pool/items/${item.id}/trash`, { method: 'POST' })).status, 200);
    assert.equal((await fetch(`${base}${item.contentUrl}`)).status, 404);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    closeResourceDatabase();
    rmSync(root, { recursive: true, force: true });
    if (previousDataRoot === undefined) delete process.env.APP_DATA_ROOT;
    else process.env.APP_DATA_ROOT = previousDataRoot;
  }
});
