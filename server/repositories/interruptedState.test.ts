/** @license SPDX-License-Identifier: Apache-2.0 */

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const root = await mkdtemp(path.join(os.tmpdir(), 'demo-interrupted-state-'));
process.env.APP_DATA_ROOT = root;

const { createWorkspaceContext, runWithWorkspace } = await import('../context/workspaceContext');
const { appendMaterials, getMaterials, markProcessingMaterialsInterrupted } = await import('./materialRepository');
const { getGradingBatch, markRunningGradingBatchesInterrupted, saveGradingBatch } = await import('./gradingBatchRepository');

after(async () => {
  await rm(root, { recursive: true, force: true });
});

test('marks only in-flight material and grading states as failed after restart', () => {
  const workspace = createWorkspaceContext('user-test', 'workspace-test', 'teacher');
  runWithWorkspace(workspace, () => {
    appendMaterials('task-1', [
      {
        id: 'material-running',
        taskId: 'task-1',
        kind: 'assignment',
        fileName: 'running.pdf',
        mimeType: 'application/pdf',
        status: 'processing',
        diskPath: path.join(workspace.uploadDirectory, 'running.pdf'),
        publicUrl: '/api/material-running',
      },
      {
        id: 'material-ready',
        taskId: 'task-1',
        kind: 'reference-answer',
        fileName: 'ready.pdf',
        mimeType: 'application/pdf',
        status: 'ready',
        diskPath: path.join(workspace.uploadDirectory, 'ready.pdf'),
        publicUrl: '/api/material-ready',
      },
    ]);
    saveGradingBatch({
      taskId: 'task-1',
      status: 'running',
      mode: 'batch-checkpoint',
      totalStudents: 2,
      processedStudents: 1,
      failedStudentIds: [],
      studentIds: ['student-1', 'student-2'],
      confirmedStudentIds: ['student-1'],
      updatedAt: 'before-restart',
    });

    assert.equal(markProcessingMaterialsInterrupted(), 1);
    assert.equal(markRunningGradingBatchesInterrupted(), 1);
    assert.deepEqual(getMaterials('task-1').map(item => [item.id, item.status, item.parseErrorCode]), [
      ['material-running', 'failed', 'PROCESSING_INTERRUPTED'],
      ['material-ready', 'ready', undefined],
    ]);
    const batch = getGradingBatch('task-1');
    assert.equal(batch?.status, 'failed');
    assert.deepEqual(batch?.failedStudentIds, ['student-2']);
    assert.ok(batch?.completedAt);
  });
});
