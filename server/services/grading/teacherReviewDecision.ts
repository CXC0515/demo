/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationResultSource, CalibrationSample, GradingFeedbackReason, GradingReviewDecision } from '../../../src/domain/types';

interface TeacherReviewDecision {
  finalScore: number;
  reason: string;
  resultSource: CalibrationResultSource;
  correctedText?: string;
  reviewDecision?: GradingReviewDecision;
  feedbackReasons?: GradingFeedbackReason[];
}

export const applyTeacherReviewDecision = (sample: CalibrationSample, decision: TeacherReviewDecision): CalibrationSample => {
  if (decision.finalScore > sample.fullScore) throw new Error('TEACHER_SCORE_EXCEEDS_FULL_SCORE');
  if (decision.resultSource === 'ai-confirmed' && decision.finalScore !== sample.aiScore) throw new Error('AI_SCORE_CONFIRMATION_MISMATCH');
  const deferred = decision.reviewDecision === 'deferred';
  const rawText = sample.rawOcrText ?? sample.ocrText;
  const correctedText = decision.correctedText?.trim();
  return {
    ...sample,
    ocrText: correctedText || sample.ocrText,
    teacherCorrectedText: correctedText && correctedText !== rawText ? correctedText : undefined,
    status: deferred ? sample.status : 'confirmed',
    resultSource: deferred ? sample.resultSource : decision.resultSource,
    teacherScore: deferred ? sample.teacherScore : decision.finalScore,
    teacherReason: decision.reason,
    isFinal: deferred ? sample.isFinal : true,
    reviewStatus: decision.reviewDecision === 'deferred' ? 'deferred' : decision.reviewDecision ? 'resolved' : sample.reviewStatus,
    reviewDecision: decision.reviewDecision,
    feedbackReasons: decision.feedbackReasons,
    reviewedAt: decision.reviewDecision && decision.reviewDecision !== 'deferred' ? new Date().toISOString() : sample.reviewedAt
  };
};
