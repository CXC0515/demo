/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

const sourceSchema = z.object({
  assetKind: z.enum(['assignment', 'reference-answer']),
  fileName: z.string().min(1),
  pageNumber: z.number().int().positive(),
  boundingBox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1)
  }),
  ocrText: z.string(),
  confidence: z.number().min(0).max(1)
});

export const assignmentAnalysisSchema = z.object({
  questions: z.array(z.object({
    displayNo: z.string().min(1),
    parentDisplayNo: z.string().optional(),
    title: z.string().min(1),
    stem: z.string().min(1),
    score: z.number().nonnegative(),
    questionType: z.string().min(1),
    answerRequirement: z.string(),
    parseConfidence: z.number().min(0).max(1),
    questionSource: sourceSchema,
    referenceAnswer: z.object({
      originalOcrText: z.string(),
      normalizedText: z.string(),
      source: sourceSchema.optional()
    }),
    rubricPoints: z.array(z.object({
      point: z.string().min(1),
      score: z.number().nonnegative(),
      description: z.string()
    })),
    knowledgeCandidates: z.array(z.object({
      nodeId: z.string(),
      nodeName: z.string(),
      confidence: z.number().min(0).max(1)
    }))
  }))
});

export type AssignmentAnalysis = z.infer<typeof assignmentAnalysisSchema>;

export const assignmentAnalysisJsonSchema = z.toJSONSchema(assignmentAnalysisSchema);
