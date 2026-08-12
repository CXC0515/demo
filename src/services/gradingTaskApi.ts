/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkbenchTask } from '../domain/types';

export const listGradingTasks = async () => {
  const response = await fetch('/api/grading-task-list');
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return (await response.json() as { tasks: WorkbenchTask[] }).tasks;
};

export const saveGradingTask = async (task: WorkbenchTask) => {
  const response = await fetch(`/api/grading-task-list/${encodeURIComponent(task.id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task)
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return (await response.json() as { task: WorkbenchTask }).task;
};
