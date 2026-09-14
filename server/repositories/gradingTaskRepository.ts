/** @license SPDX-License-Identifier: Apache-2.0 */
import { WorkbenchTask } from '../../src/domain/types';
import { workspaceArrayStore } from './workspaceFileStore';
export const upsertGradingTask = (current: WorkbenchTask[], task: WorkbenchTask) => { const index = current.findIndex(item => item.id === task.id); return index >= 0 ? current.map(item => item.id === task.id ? task : item) : [task, ...current]; };
export const listGradingTasks = () => [...workspaceArrayStore<WorkbenchTask>('grading-tasks.json').values];
export const saveGradingTask = (task: WorkbenchTask) => { const current = workspaceArrayStore<WorkbenchTask>('grading-tasks.json'); current.values.splice(0, current.values.length, ...upsertGradingTask(current.values, task)); current.persist(); return task; };
export const deleteGradingTask = (taskId: string) => { const current = workspaceArrayStore<WorkbenchTask>('grading-tasks.json'); const index = current.values.findIndex(item => item.id === taskId); if (index < 0) return false; current.values.splice(index, 1); current.persist(); return true; };
