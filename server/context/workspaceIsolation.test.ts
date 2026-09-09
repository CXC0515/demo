/** @license SPDX-License-Identifier: Apache-2.0 */

import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = await mkdtemp(path.join(os.tmpdir(), 'demo-workspace-isolation-'));
process.env.APP_DATA_ROOT = root;
const { createWorkspaceContext, getWorkspaceContext, runWithWorkspace } = await import('./workspaceContext');
const { authenticatedUploadPath, bindAuthenticatedWorkspace, resumeAuthenticatedWorkspace } = await import('../middleware/authenticated');
const { getRosterDatabase, closeRosterDatabase } = await import('../database/rosterDatabase');

test('roster data is isolated by workspace context', () => {
  const first = createWorkspaceContext('user-first', 'workspace-first', 'teacher');
  const second = createWorkspaceContext('user-second', 'workspace-second', 'teacher');
  runWithWorkspace(first, () => {
    getRosterDatabase().prepare(`INSERT INTO classes (id, name, grade, term, head_teacher, textbook_version, default_submit_time, status, created_at, updated_at) VALUES ('same-id', '一班', '七年级', '2026', '', '', '', 'active', 'now', 'now')`).run();
  });
  runWithWorkspace(second, () => {
    assert.equal((getRosterDatabase().prepare('SELECT COUNT(*) AS count FROM classes').get() as { count: number }).count, 0);
    getRosterDatabase().prepare(`INSERT INTO classes (id, name, grade, term, head_teacher, textbook_version, default_submit_time, status, created_at, updated_at) VALUES ('same-id', '二班', '七年级', '2026', '', '', '', 'active', 'now', 'now')`).run();
  });
  runWithWorkspace(first, () => assert.equal((getRosterDatabase().prepare('SELECT name FROM classes WHERE id = ?').get('same-id') as { name: string }).name, '一班'));
  runWithWorkspace(second, () => assert.equal((getRosterDatabase().prepare('SELECT name FROM classes WHERE id = ?').get('same-id') as { name: string }).name, '二班'));
  closeRosterDatabase();
});

test('multipart continuation restores the authenticated workspace and upload root', () => {
  const context = createWorkspaceContext('user-upload', 'workspace-upload', 'teacher');
  const request = {} as never;
  bindAuthenticatedWorkspace(request, context);
  assert.equal(authenticatedUploadPath(request, 'schedule'), path.join(context.uploadDirectory, 'schedule'));

  let observedWorkspaceId = '';
  const response = { status: () => response, json: () => response } as never;
  resumeAuthenticatedWorkspace(request, response, () => {
    observedWorkspaceId = getWorkspaceContext().workspaceId;
  });
  assert.equal(observedWorkspaceId, context.workspaceId);
});
