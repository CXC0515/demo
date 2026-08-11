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

export const trialGradingModelOutputSchema = z.object({
  samples: z.array(z.object({
    questionId: z.string().min(1),
    assetId: z.string().min(1),
    studentAnswer: z.string(),
    score: z.number().nonnegative().nullable(),
    confidence: z.number().min(0).max(1),
    matchedPoints: z.array(z.string()),
    missedPoints: z.array(z.string()),
    reason: z.string(),
    needsTeacherReview: z.boolean()
  }))
});

export type TrialGradingRequest = z.infer<typeof trialGradingRequestSchema>;
