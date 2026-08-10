/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FirstSectionAnalysis } from '../../src/domain/types';

const dataDirectory = path.resolve('var/data');
const dataPath = path.join(dataDirectory, 'first-section-analyses.json');
mkdirSync(dataDirectory, { recursive: true });

const loadAnalyses = () => {
  try {
    return new Map(JSON.parse(readFileSync(dataPath, 'utf8')) as [string, FirstSectionAnalysis][]);
  } catch {
    return new Map<string, FirstSectionAnalysis>();
  }
};

const analyses = loadAnalyses();

const persist = () => {
  const temporaryPath = `${dataPath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify([...analyses.entries()]));
  renameSync(temporaryPath, dataPath);
};

export const getFirstSectionAnalysis = (taskId: string) => analyses.get(taskId);

export const saveFirstSectionAnalysis = (analysis: FirstSectionAnalysis) => {
  analyses.set(analysis.taskId, analysis);
  persist();
  return analysis;
};

export const deleteFirstSectionAnalysis = (taskId: string) => {
  if (!analyses.delete(taskId)) return;
  persist();
};
