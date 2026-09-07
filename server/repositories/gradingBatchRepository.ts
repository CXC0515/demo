/** @license SPDX-License-Identifier: Apache-2.0 */
import { GradingBatch } from '../../src/domain/types';
import { workspaceMapStore } from './workspaceFileStore';
const store = () => workspaceMapStore<GradingBatch>('grading-batches.json');
export const getGradingBatch = (taskId: string) => store().values.get(taskId);
export const saveGradingBatch = (batch: GradingBatch) => { const current = store(); current.values.set(batch.taskId, batch); current.persist(); return batch; };
export const deleteGradingBatch = (taskId: string) => { const current = store(); if (current.values.delete(taskId)) current.persist(); };
