/** @license SPDX-License-Identifier: Apache-2.0 */
import { GradingBatch } from '../../src/domain/types';
import { workspaceMapStore } from './workspaceFileStore';
const store = () => workspaceMapStore<GradingBatch>('grading-batches.json');
export const getGradingBatch = (taskId: string) => store().values.get(taskId);
export const saveGradingBatch = (batch: GradingBatch) => { const current = store(); current.values.set(batch.taskId, batch); current.persist(); return batch; };
export const deleteGradingBatch = (taskId: string) => { const current = store(); if (current.values.delete(taskId)) current.persist(); };
export const markRunningGradingBatchesInterrupted = () => {
  const current = store();
  const timestamp = new Date().toISOString();
  let changes = 0;
  for (const [taskId, batch] of current.values) {
    if (batch.status !== 'running') continue;
    changes += 1;
    const outstandingStudentIds = batch.studentIds.filter(id => !batch.confirmedStudentIds.includes(id));
    current.values.set(taskId, {
      ...batch,
      status: 'failed',
      failedStudentIds: [...new Set([...batch.failedStudentIds, ...outstandingStudentIds])],
      completedAt: timestamp,
      updatedAt: timestamp,
    });
  }
  if (changes) current.persist();
  return changes;
};
