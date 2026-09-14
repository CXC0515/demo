/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnalyzedQuestion, AnalyzedQuestionUnit, GradingRubricPoint } from './types';

export const resolvedUnitScore = (unit: Pick<AnalyzedQuestionUnit, 'score'> & Partial<Pick<AnalyzedQuestionUnit, 'rubricPoints'>>) =>
  unit.score ?? Math.max(1, unit.rubricPoints?.length ?? 0);

export const resolvedQuestionScore = (question: Pick<AnalyzedQuestion, 'score' | 'subquestions'> & Partial<Pick<AnalyzedQuestion, 'rubricPoints'>>) =>
  question.score ?? (question.subquestions.length
    ? question.subquestions.reduce((total, unit) => total + resolvedUnitScore(unit), 0)
    : resolvedUnitScore(question));

export const resolveRubricScores = (
  points: AnalyzedQuestionUnit['rubricPoints'],
  fullScore: number,
  fallbackPoint: string
): GradingRubricPoint[] => {
  if (!points.length) return [{ point: fallbackPoint, score: fullScore, description: '' }];
  const explicitTotal = points.reduce((total, point) => total + (point.score ?? 0), 0);
  const missingCount = points.filter(point => point.score === null).length;
  const missingScore = missingCount ? Math.max(0, fullScore - explicitTotal) / missingCount : 0;
  return points.map(point => ({
    point: point.point,
    score: point.score ?? missingScore,
    description: point.description
  }));
};
