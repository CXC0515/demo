/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const gradingRubricInputSchema = z.object({
  standardAnswer: z.string(),
  gradingRubric: z.array(z.object({
    point: z.string().min(1),
    score: z.number().min(0),
    description: z.string()
  })).max(100),
  teacherRules: z.array(z.string().min(1)).max(100),
  rubricVersion: z.number().int().positive()
});
