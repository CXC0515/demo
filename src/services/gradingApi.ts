/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentAsset, GradingRubricPoint, KnowledgeNode } from '../domain/types';

interface AnalysisSourceDto {
  assetKind: 'assignment' | 'reference-answer';
  fileName: string;
  pageNumber: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  ocrText: string;
  confidence: number;
}

export interface AnalyzedQuestionDto {
  displayNo: string;
  parentDisplayNo?: string;
  title: string;
  stem: string;
  score: number;
  questionType: string;
  answerRequirement: string;
  parseConfidence: number;
  questionSource: AnalysisSourceDto;
  referenceAnswer: { originalOcrText: string; normalizedText: string; source?: AnalysisSourceDto };
  rubricPoints: GradingRubricPoint[];
  knowledgeCandidates: { nodeId: string; nodeName: string; confidence: number }[];
}

const readErrorCode = async (response: Response) => {
  const body = await response.json().catch(() => ({})) as { code?: string };
  return body.code ?? `HTTP_${response.status}`;
};

export const uploadTaskMaterials = async (taskId: string, kind: 'assignment' | 'reference-answer', files: File[]) => {
  const form = new FormData();
  form.set('kind', kind);
  files.forEach(file => form.append('files', file));
  const response = await fetch(`/api/grading-tasks/${taskId}/materials`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { assets: DocumentAsset[] };
  return body.assets;
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
  const body = await response.json() as { status: 'needs-review'; analysis: { questions: AnalyzedQuestionDto[] } };
  return body.analysis.questions;
};
