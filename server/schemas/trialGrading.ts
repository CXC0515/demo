/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const trialGradingRequestSchema = z.object({
  questions: z.array(z.object({
    questionId: z.string().min(1),
    displayNo: z.string().min(1),
    stem: z.string(),
    fullScore: z.number().nonnegative(),
    standardAnswer: z.string(),
    rubricPoints: z.array(z.object({
      point: z.string(),
      score: z.number().nonnegative(),
      description: z.string()
    })),
    teacherRules: z.array(z.string()),
    rubricVersion: z.number().int().positive()
  })).min(1).max(50),
  submissions: z.array(z.object({
    assetId: z.string().min(1),
    studentId: z.string().min(1),
    studentName: z.string().min(1),
    studentNo: z.string().min(1)
  })).min(1).max(20)
});

const gradingPointReferenceSchema = z.union([
  z.string(),
  z.object({
    point: z.string().optional(),
    description: z.string().optional()
  }).passthrough().refine(value => Boolean(value.point?.trim() || value.description?.trim()), 'EMPTY_GRADING_POINT_REFERENCE')
]).transform(value => typeof value === 'string' ? value : value.point?.trim() || value.description?.trim() || '');

export const trialGradingModelOutputSchema = z.object({
  samples: z.array(z.object({
    questionId: z.string().min(1),
    assetId: z.string().min(1),
    score: z.number().nonnegative().nullable(),
    confidence: z.number().min(0).max(1),
    matchedPoints: z.array(gradingPointReferenceSchema),
    missedPoints: z.array(gradingPointReferenceSchema),
    reason: z.string(),
    needsTeacherReview: z.boolean()
  }))
});

export type TrialGradingRequest = z.infer<typeof trialGradingRequestSchema>;
