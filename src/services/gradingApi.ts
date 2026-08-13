/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationResultSource, CalibrationSample, DocumentAsset, FirstSectionAnalysis, GradingBatch, GradingDiagnosis, GradingFeedbackReason, GradingMode, GradingQuestion, GradingReviewDecision, KnowledgeNode, NormalizedDocument, TaskQuestionRubric, TrialGradingQuestionInput, TrialGradingResult, TrialGradingSubmissionInput, VisionValidationResult } from '../domain/types';

const readErrorCode = async (response: Response) => {
  const body = await response.json().catch(() => ({})) as { code?: string };
  return body.code ?? `HTTP_${response.status}`;
};

export const uploadTaskMaterials = async (taskId: string, kind: 'assignment' | 'reference-answer' | 'student-submission', files: File[]) => {
  const form = new FormData();
  form.set('kind', kind);
  files.forEach(file => form.append('files', file));
  const response = await fetch(`/api/grading-tasks/${taskId}/materials`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { assets: DocumentAsset[] };
  return body.assets;
};

export const clearStudentSubmissions = async (taskId: string) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/student-submissions`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await readErrorCode(response));
};

export interface TaskMaterialsResult {
  assets: DocumentAsset[];
  documents: NormalizedDocument[];
}

export const getTaskMaterials = async (taskId: string): Promise<TaskMaterialsResult> => {
  const response = await fetch(`/api/grading-tasks/${taskId}/materials`);
  if (!response.ok) throw new Error(await readErrorCode(response));
  return response.json() as Promise<TaskMaterialsResult>;
};

export const waitForTaskMaterials = async (taskId: string, assetIds: string[], timeoutMs = 15 * 60 * 1000) => {
  const startedAt = Date.now();
  const expectedIds = new Set(assetIds);
  while (Date.now() - startedAt < timeoutMs) {
    const result = await getTaskMaterials(taskId);
    const expectedAssets = result.assets.filter(asset => expectedIds.has(asset.id));
    const failed = expectedAssets.find(asset => asset.status === 'failed');
    if (failed) throw new Error(failed.parseErrorCode ?? 'MATERIAL_PARSE_FAILED');
    if (expectedAssets.length === expectedIds.size && expectedAssets.every(asset => asset.status === 'ready' || asset.status === 'needs-review')) return result;
    await new Promise(resolve => window.setTimeout(resolve, 1200));
  }
  throw new Error('MATERIAL_PARSE_TIMEOUT');
};

export const analyzeTaskMaterials = async (taskId: string, knowledgeNodes: KnowledgeNode[]) => {
  const knowledgeCatalog = knowledgeNodes
    .filter(node => node.type === 'knowledge' || node.type === 'capability')
    .map(node => ({ id: node.id, name: node.name, type: node.type, description: node.desc }));
  const response = await fetch(`/api/grading-tasks/${taskId}/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgeCatalog })
  });
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { analysis: FirstSectionAnalysis };
  return body.analysis;
};

export const getTaskAnalysis = async (taskId: string) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/analysis`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { analysis: FirstSectionAnalysis };
  return body.analysis;
};

export const saveTaskQuestionCorrection = async (taskId: string, displayNo: string, correction: { title: string; stem: string; answerRequirement: string; standardAnswer?: string }) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/analysis/questions/${encodeURIComponent(displayNo)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(correction)
  });
  if (!response.ok) throw new Error(await readErrorCode(response));
  return (await response.json() as { analysis: FirstSectionAnalysis }).analysis;
};

export const getTaskRubrics = async (taskId: string) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/rubrics`);
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { rubrics: TaskQuestionRubric[] };
  return body.rubrics;
};

export const saveTaskRubric = async (taskId: string, rubric: Omit<TaskQuestionRubric, 'taskId' | 'updatedAt'>) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/rubrics/${encodeURIComponent(rubric.questionId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rubric)
  });
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { rubric: TaskQuestionRubric };
  return body.rubric;
};

export const gradeTaskTrial = async (
  taskId: string,
  questions: TrialGradingQuestionInput[],
  submissions: TrialGradingSubmissionInput[]
) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/trial-grading`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions, submissions })
  });
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { result: TrialGradingResult };
  return body.result;
};

export const getTaskTrialGrading = async (taskId: string) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/trial-grading`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { result: TrialGradingResult };
  return body.result;
};

export const correctTrialOcr = async (taskId: string, sampleId: string, correctedText: string, question: TrialGradingQuestionInput, submission: TrialGradingSubmissionInput) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/trial-grading/${encodeURIComponent(sampleId)}/ocr-correction`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correctedText, question, submission }) });
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { sample: CalibrationSample };
  return body.sample;
};

export const saveTeacherReview = async (taskId: string, sampleId: string, finalScore: number, reason: string, resultSource: CalibrationResultSource, correctedText?: string, reviewDecision?: GradingReviewDecision, feedbackReasons?: GradingFeedbackReason[]) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/trial-grading/${encodeURIComponent(sampleId)}/teacher-review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finalScore, reason, resultSource, correctedText, reviewDecision, feedbackReasons })
  });
  if (!response.ok) throw new Error(await readErrorCode(response));
  return (await response.json() as { sample: CalibrationSample }).sample;
};

export const getBatchGrading = async (taskId: string) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/batch-grading`);
  if (!response.ok) throw new Error(await readErrorCode(response));
  return (await response.json() as { batch: GradingBatch }).batch;
};

export const startBatchGrading = async (taskId: string, mode: GradingMode, questions: TrialGradingQuestionInput[], submissions: TrialGradingSubmissionInput[]) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/batch-grading/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, questions, submissions }) });
  if (!response.ok) throw new Error(await readErrorCode(response));
  return response.json() as Promise<{ batch: GradingBatch; result: TrialGradingResult }>;
};

export const setBatchGradingAction = async (taskId: string, action: 'pause' | 'resume') => {
  const response = await fetch(`/api/grading-tasks/${taskId}/batch-grading/${action}`, { method: 'POST' });
  if (!response.ok) throw new Error(await readErrorCode(response));
  return (await response.json() as { batch: GradingBatch }).batch;
};

export const confirmBatchStudents = async (taskId: string, studentIds: string[]) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/batch-grading/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentIds }) });
  if (!response.ok) throw new Error(await readErrorCode(response));
  return (await response.json() as { batch: GradingBatch }).batch;
};

export const getGradingDiagnosis = async (taskId: string, questions: GradingQuestion[]) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/diagnosis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: questions.map(({ id, displayNo, score }) => ({ id, displayNo, score })) }) });
  if (!response.ok) throw new Error(await readErrorCode(response));
  return (await response.json() as { diagnosis: GradingDiagnosis }).diagnosis;
};

export const runVisionValidation = async (taskId: string, assetId: string, questionNos = ['2', '3', '4', '5', '6']) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/vision-validation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, questionNos })
  });
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { result: VisionValidationResult };
  return body.result;
};

export const getVisionValidation = async (taskId: string, assetId: string) => {
  const response = await fetch(`/api/grading-tasks/${taskId}/vision-validation/${encodeURIComponent(assetId)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { result: VisionValidationResult };
  return body.result;
};
