/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TaskQuestionRubric } from '../../src/domain/types';

const dataDirectory = path.resolve('var/data');
const dataPath = path.join(dataDirectory, 'grading-rubrics.json');
mkdirSync(dataDirectory, { recursive: true });

const load = () => {
  try {
    return new Map(JSON.parse(readFileSync(dataPath, 'utf8')) as [string, TaskQuestionRubric][]);
  } catch {
    return new Map<string, TaskQuestionRubric>();
  }
};

const rubrics = load();
const keyFor = (taskId: string, questionId: string) => `${taskId}:${questionId}`;
const persist = () => {
  const temporary = `${dataPath}.tmp`;
  writeFileSync(temporary, JSON.stringify([...rubrics.entries()]));
  renameSync(temporary, dataPath);
};

export const getTaskRubrics = (taskId: string) => [...rubrics.values()].filter(rubric => rubric.taskId === taskId);

export const saveTaskRubric = (rubric: TaskQuestionRubric) => {
  rubrics.set(keyFor(rubric.taskId, rubric.questionId), rubric);
  persist();
  return rubric;
};
