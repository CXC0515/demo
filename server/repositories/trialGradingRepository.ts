/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TrialGradingResult } from '../../src/domain/types';

const dataDirectory = path.resolve('var/data');
const dataPath = path.join(dataDirectory, 'trial-grading-results.json');
mkdirSync(dataDirectory, { recursive: true });

const loadResults = () => {
  try {
    return new Map(JSON.parse(readFileSync(dataPath, 'utf8')) as [string, TrialGradingResult][]);
  } catch {
    return new Map<string, TrialGradingResult>();
  }
};

const results = loadResults();

const persist = () => {
  const temporaryPath = `${dataPath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify([...results.entries()]));
  renameSync(temporaryPath, dataPath);
};

export const getTrialGradingResult = (taskId: string) => results.get(taskId);

export const saveTrialGradingResult = (result: TrialGradingResult) => {
  results.set(result.taskId, result);
  persist();
  return result;
};

export const deleteTrialGradingResult = (taskId: string) => {
  if (!results.delete(taskId)) return;
  persist();
};
