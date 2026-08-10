/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssignmentAnalysis } from '../../schemas/assignmentAnalysis';

export interface AnalysisFile {
  fileName: string;
  mimeType: string;
  kind: 'assignment' | 'reference-answer';
  dataBase64: string;
}

export interface KnowledgeCatalogItem {
  id: string;
  name: string;
  type: string;
  description: string;
}

export interface AssignmentAnalysisInput {
  files: AnalysisFile[];
  knowledgeCatalog: KnowledgeCatalogItem[];
}

export interface MultimodalProvider {
  analyzeAssignment(input: AssignmentAnalysisInput): Promise<AssignmentAnalysis>;
}
