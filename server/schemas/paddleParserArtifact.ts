/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const parsingBlockSchema = z.object({
  block_label: z.string(),
  block_content: z.string().default(''),
  block_bbox: bboxSchema,
  block_id: z.number(),
  block_order: z.number().nullable().optional()
}).passthrough();

export const paddleParserArtifactSchema = z.object({
  model: z.string(),
  pages: z.array(z.object({
    pageNumber: z.number().int().positive(),
    prunedResult: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      parsing_res_list: z.array(parsingBlockSchema)
    }).passthrough()
  }).passthrough()).min(1)
}).passthrough();

export type PaddleParserArtifact = z.infer<typeof paddleParserArtifactSchema>;

export const visionValidationRequestSchema = z.object({
  assetId: z.string().min(1),
  questionNos: z.array(z.string().regex(/^\d+$/)).min(1).max(10).default(['2', '3', '4', '5', '6'])
});

export const visionRecognitionOutputSchema = z.object({
  items: z.array(z.object({
    displayNo: z.string().min(1),
    recognizedAnswer: z.string().default(''),
    answerFields: z.array(z.object({
      fieldId: z.string().min(1),
      text: z.string(),
      crossedOutText: z.array(z.string()).default([]),
      confidence: z.number().min(0).max(1),
      needsReview: z.boolean()
    })).default([]),
    crossedOutText: z.array(z.string()).default([]),
    selectedOption: z.string().nullable().default(null),
    visualEvidence: z.string().default(''),
    existingMarkings: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1),
    needsReview: z.boolean()
  }))
});

export const visionRegionLocatorOutputSchema = z.object({
  items: z.array(z.object({
    displayNo: z.string().regex(/^\d+$/),
    boundingBox: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1)
    }),
    evidenceUnits: z.array(z.object({
      evidenceId: z.string().min(1),
      kind: z.enum(['text', 'choice', 'formula', 'diagram', 'table', 'mixed']),
      boundingBox: z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().positive().max(1),
        height: z.number().positive().max(1)
      }),
      provisionalText: z.string().default(''),
      confidence: z.number().min(0).max(1),
      needsReview: z.boolean(),
      reason: z.string()
    })).min(1),
    confidence: z.number().min(0).max(1),
    needsReview: z.boolean(),
    reason: z.string()
  }))
});
