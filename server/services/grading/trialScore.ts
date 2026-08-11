/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GradingRubricPoint } from '../../../src/domain/types';

export const resolveTrialScore = (
  fullScore: number,
  rubricPoints: GradingRubricPoint[],
  matchedPoints: string[],
  missedPoints: string[],
  modelScore: number | null
) => {
  const classified = new Set([...matchedPoints, ...missedPoints]);
  const rubricIsFullyClassified = rubricPoints.length > 0 && rubricPoints.every(point => classified.has(point.point));
  if (!rubricIsFullyClassified) return modelScore === null ? null : Math.min(fullScore, modelScore);
  const matched = new Set(matchedPoints);
  return Math.min(fullScore, rubricPoints.reduce((total, point) => total + (matched.has(point.point) ? point.score : 0), 0));
};
