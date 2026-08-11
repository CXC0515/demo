/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentAsset, FirstSectionAnalysis, KnowledgeNode, NormalizedDocument, TaskQuestionRubric, TrialGradingQuestionInput, TrialGradingResult, TrialGradingSubmissionInput, VisionValidationResult } from '../domain/types';

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
