/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationResultSource, CalibrationSample } from '../../../src/domain/types';

interface TeacherReviewDecision {
  finalScore: number;
  reason: string;
  resultSource: CalibrationResultSource;
  correctedText?: string;
}

export const applyTeacherReviewDecision = (sample: CalibrationSample, decision: TeacherReviewDecision): CalibrationSample => {
  if (decision.finalScore > sample.fullScore) throw new Error('TEACHER_SCORE_EXCEEDS_FULL_SCORE');
  if (decision.resultSource === 'ai-confirmed' && decision.finalScore !== sample.aiScore) throw new Error('AI_SCORE_CONFIRMATION_MISMATCH');
  const rawText = sample.rawOcrText ?? sample.ocrText;
  const correctedText = decision.correctedText?.trim();
  return {
    ...sample,
    ocrText: correctedText || sample.ocrText,
    teacherCorrectedText: correctedText && correctedText !== rawText ? correctedText : undefined,
    status: 'confirmed',
    resultSource: decision.resultSource,
    teacherScore: decision.finalScore,
    teacherReason: decision.reason,
    isFinal: true
  };
};
