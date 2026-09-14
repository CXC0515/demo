/** @license SPDX-License-Identifier: Apache-2.0 */
import { TaskQuestionRubric } from '../../src/domain/types';
import { workspaceMapStore } from './workspaceFileStore';
const store = () => workspaceMapStore<TaskQuestionRubric>('grading-rubrics.json');
const keyFor = (taskId: string, questionId: string) => `${taskId}:${questionId}`;
export const getTaskRubrics = (taskId: string) => [...store().values.values()].filter(rubric => rubric.taskId === taskId);
export const saveTaskRubric = (rubric: TaskQuestionRubric) => { const current = store(); current.values.set(keyFor(rubric.taskId, rubric.questionId), rubric); current.persist(); return rubric; };
export const deleteTaskRubrics = (taskId: string) => { const current = store(); let changed = false; for (const [key, rubric] of current.values) if (rubric.taskId === taskId) { current.values.delete(key); changed = true; } if (changed) current.persist(); };
