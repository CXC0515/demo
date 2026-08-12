/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GradingRubricPoint, VisionValidationItem } from '../../../src/domain/types';

export const formatPaddleTextForDisplay = (value: string) => value
  .replace(/\$?\s*\\underline\s*\{\s*\\text\s*\{([^{}]*)\}\s*\}\s*\$?/g, '$1')
  .replace(/\$?\s*\\underline\s*\{([^{}]*)\}\s*\$?/g, '$1')
  .replace(/\s+/g, ' ')
  .replace(/\s+([①②③④⑤⑥⑦⑧⑨⑩])/g, ' $1')
  .trim();

export const inferAnswerCardOption = (value: string) => {
  const tokens = [...value.toUpperCase().matchAll(/\[\s*([A-Z])\s*\]/g)].map(match => match[1]);
  if (tokens.length !== 3) return null;
  const normalizedTokens = tokens.join('') === 'HCD' ? ['B', 'C', 'D'] : tokens;
  const options = ['A', 'B', 'C', 'D'];
  const candidates = options.filter(missing => {
    const visible = options.filter(option => option !== missing);
    return normalizedTokens.every((token, index) => token === visible[index]);
  });
  return candidates.length === 1 ? candidates[0] : null;
};

export const getObservedAnswer = (item: VisionValidationItem) =>
  item.selectedOption || formatPaddleTextForDisplay(item.paddleText) || item.lunaText || '';

export const recognitionTextsConflict = (paddleText: string, lunaText: string) => {
  const normalize = (value: string) => value.replace(/[\s\[\]（）()。,.，_:：;；、\\$\-]/g, '').toUpperCase();
  const paddle = normalize(paddleText);
  const luna = normalize(lunaText);
  return Boolean(paddle && luna && paddle !== luna && !paddle.includes(luna) && !luna.includes(paddle));
};

export const resolveTrialConfidence = (gradingConfidence: number, item: VisionValidationItem) =>
  Math.min(gradingConfidence, item.confidence);

export const trialNeedsTeacherReview = (modelNeedsReview: boolean, item: VisionValidationItem) =>
  modelNeedsReview || item.needsReview || item.locationStatus !== 'located';

export const hasSuspiciousRepeatedShortAnswer = (value: string) => /^([\p{Script=Han}A-Za-z0-9])\1$/u.test(value.trim());

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
