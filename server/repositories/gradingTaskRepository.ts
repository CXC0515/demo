/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WorkbenchTask } from '../../src/domain/types';

const dataDirectory = path.resolve('var/data');
const dataPath = path.join(dataDirectory, 'grading-tasks.json');
mkdirSync(dataDirectory, { recursive: true });

const loadTasks = () => {
  try { return JSON.parse(readFileSync(dataPath, 'utf8')) as WorkbenchTask[]; }
  catch { return []; }
};
const tasks = loadTasks();
const persist = () => {
  const temporaryPath = `${dataPath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(tasks));
  renameSync(temporaryPath, dataPath);
};

export const upsertGradingTask = (current: WorkbenchTask[], task: WorkbenchTask) => {
  const index = current.findIndex(item => item.id === task.id);
  return index >= 0 ? current.map(item => item.id === task.id ? task : item) : [task, ...current];
};

export const listGradingTasks = () => [...tasks];
export const saveGradingTask = (task: WorkbenchTask) => {
  tasks.splice(0, tasks.length, ...upsertGradingTask(tasks, task));
  persist();
  return task;
};
