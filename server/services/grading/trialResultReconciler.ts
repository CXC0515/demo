/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrialGradingResult } from '../../../src/domain/types';
import { TrialGradingRequest } from '../../schemas/trialGrading';

export const findSubmissionsNeedingTrialGrading = (
  result: TrialGradingResult | undefined,
  request: TrialGradingRequest
) => request.submissions.filter(submission => request.questions.some(question => {
  const sample = result?.samples.find(item => item.sourceAssetId === submission.assetId && item.questionId === question.questionId);
  return !sample || sample.rubricVersion !== question.rubricVersion;
}));

export const mergeCurrentTrialSamples = (
  result: TrialGradingResult | undefined,
  request: TrialGradingRequest,
  refreshedSamples: TrialGradingResult['samples']
) => {
  const currentAssetIds = new Set(request.submissions.map(item => item.assetId));
  const currentQuestions = new Map(request.questions.map(item => [item.questionId, item.rubricVersion]));
  const refreshedKeys = new Set(refreshedSamples.map(item => `${item.questionId}:${item.sourceAssetId}`));
  const retained = (result?.samples ?? []).filter(sample =>
    currentAssetIds.has(sample.sourceAssetId)
    && currentQuestions.get(sample.questionId) === sample.rubricVersion
    && !refreshedKeys.has(`${sample.questionId}:${sample.sourceAssetId}`)
  );
  return [...retained, ...refreshedSamples];
};
