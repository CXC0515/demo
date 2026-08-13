/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { VisionValidationResult } from '../../src/domain/types';

const dataDirectory = path.resolve('var/data');
const dataPath = path.join(dataDirectory, 'vision-validation-results.json');
mkdirSync(dataDirectory, { recursive: true });

const loadResults = () => {
  try {
    return new Map(JSON.parse(readFileSync(dataPath, 'utf8')) as [string, VisionValidationResult][]);
  } catch {
    return new Map<string, VisionValidationResult>();
  }
};

const results = loadResults();
const keyFor = (taskId: string, assetId: string) => `${taskId}:${assetId}`;
export const NON_CHOICE_RECOGNITION_VERSION = 4;

export const isVisionValidationItemCurrent = (item: VisionValidationResult['items'][number]) =>
  item.pipelineVersion === NON_CHOICE_RECOGNITION_VERSION;

const persist = () => {
  const temporary = `${dataPath}.tmp`;
  writeFileSync(temporary, JSON.stringify([...results.entries()]));
  renameSync(temporary, dataPath);
};

export const getVisionValidationResult = (taskId: string, assetId: string) => {
  const result = results.get(keyFor(taskId, assetId));
  if (!result) return undefined;
  return { ...result, items: result.items.filter(isVisionValidationItemCurrent) };
};

export const saveVisionValidationResult = (result: VisionValidationResult) => {
  results.set(keyFor(result.taskId, result.assetId), result);
  persist();
  return result;
};

export const deleteVisionValidationForTask = (taskId: string) => {
  let changed = false;
  for (const key of results.keys()) if (key.startsWith(`${taskId}:`)) { results.delete(key); changed = true; }
  if (changed) persist();
};
