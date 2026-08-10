/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkbenchTask, WorkflowState } from './types';

const pad = (value: number) => String(value).padStart(2, '0');

const localDateKey = (date: Date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;

export const toDateTimeInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const getDefaultCollectionDeadline = (now = new Date()) => {
  const deadline = new Date(now);
  deadline.setHours(deadline.getHours() + 3);
  deadline.setSeconds(0, 0);
  return deadline;
};

export const getNextDailyTaskName = (tasks: WorkbenchTask[], now = new Date()) => {
  const dateKey = localDateKey(now);
  const createdToday = tasks.filter(task => localDateKey(new Date(task.createdAt)) === dateKey).length;
  return `${dateKey}_${createdToday + 1}`;
};

export const formatCollectionDeadline = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const createEmptyWorkflowState = (task: WorkbenchTask): WorkflowState => ({
  currentStep: 1,
  taskName: task.name,
  classId: task.classId,
  deadline: task.deadline,
  relatedText: '',
  homeworkType: 'comprehensive',
  assignment: {
    status: 'draft',
    analysisStatus: 'idle',
    questionFileNames: [],
    answerFileNames: [],
    note: '',
    assets: [],
    documents: []
  },
  questions: [],
  sourceEvidence: [],
  standardAnswer: '',
  gradingRubric: [],
  uploadProgress: 0,
  isUploading: false,
  uploadedCount: 0,
  ocrResults: [],
  aiResults: [],
  rubricVersion: 1,
  gradingMode: 'batch-checkpoint',
  teacherRules: [],
  submissionPages: [],
  calibrationSamples: [],
  jointReviewQuestionIds: [],
  questionGradingStates: [],
  missingSubmissions: []
});
