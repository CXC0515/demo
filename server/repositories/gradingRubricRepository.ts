/** @license SPDX-License-Identifier: Apache-2.0 */
import { TaskQuestionRubric } from '../../src/domain/types';
import { workspaceMapStore } from './workspaceFileStore';
const store = () => workspaceMapStore<TaskQuestionRubric>('grading-rubrics.json');
const keyFor = (taskId: string, questionId: string) => `${taskId}:${questionId}`;
export const getTaskRubrics = (taskId: string) => [...store().values.values()].filter(rubric => rubric.taskId === taskId);
export const saveTaskRubric = (rubric: TaskQuestionRubric) => { const current = store(); current.values.set(keyFor(rubric.taskId, rubric.questionId), rubric); current.persist(); return rubric; };
