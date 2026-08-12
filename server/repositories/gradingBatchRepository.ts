/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GradingBatch } from '../../src/domain/types';

const dataDirectory = path.resolve('var/data');
const dataPath = path.join(dataDirectory, 'grading-batches.json');
mkdirSync(dataDirectory, { recursive: true });

const load = () => {
  try { return new Map(JSON.parse(readFileSync(dataPath, 'utf8')) as [string, GradingBatch][]); }
  catch { return new Map<string, GradingBatch>(); }
};

const batches = load();
const persist = () => {
  const temporary = `${dataPath}.tmp`;
  writeFileSync(temporary, JSON.stringify([...batches.entries()]));
  renameSync(temporary, dataPath);
};

export const getGradingBatch = (taskId: string) => batches.get(taskId);
export const saveGradingBatch = (batch: GradingBatch) => {
  batches.set(batch.taskId, batch);
  persist();
  return batch;
};
export const deleteGradingBatch = (taskId: string) => {
  if (batches.delete(taskId)) persist();
};
