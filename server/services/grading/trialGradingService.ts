/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationSample } from '../../../src/domain/types';
import { ModelConfig } from '../../config/modelConfig';
import { StoredMaterial } from '../../repositories/materialRepository';
import { getVisionValidationResult } from '../../repositories/visionValidationRepository';
import { TrialGradingRequest } from '../../schemas/trialGrading';
import { OpenAICompatibleTrialGrader } from './OpenAICompatibleTrialGrader';
import { getObservedAnswer, recognitionTextsConflict, resolveTrialConfidence, resolveTrialScore, trialNeedsTeacherReview } from './trialScore';
import { scoreObjectiveChoice } from './objectiveChoiceScore';

export const gradeTrialSubmissions = async (
  taskId: string,
  request: TrialGradingRequest,
  materials: StoredMaterial[],
  config: ModelConfig,
  answerOverrides = new Map<string, string>()
) => {
  const grader = new OpenAICompatibleTrialGrader(config);
  const modelResult = await grader.grade(taskId, request, materials, answerOverrides);
  const questionsById = new Map(request.questions.map(question => [question.questionId, question]));
  const submissionsById = new Map(request.submissions.map(submission => [submission.assetId, submission]));
  const materialsById = new Map(materials.map(material => [material.id, material]));
  const expectedKeys = new Set(request.questions.flatMap(question => request.submissions.map(submission => `${question.questionId}:${submission.assetId}`)));
  const returnedKeys = new Set(modelResult.samples.map(sample => `${sample.questionId}:${sample.assetId}`));
  if (returnedKeys.size !== expectedKeys.size || [...expectedKeys].some(key => !returnedKeys.has(key))) throw new Error('MODEL_OUTPUT_INCOMPLETE');

  return modelResult.samples.map(modelSample => {
    const question = questionsById.get(modelSample.questionId);
    const submission = submissionsById.get(modelSample.assetId);
    const material = materialsById.get(modelSample.assetId);
    if (!question || !submission || !material) throw new Error('MODEL_OUTPUT_INVALID_REFERENCE');
    const visionItem = getVisionValidationResult(taskId, material.id)?.items.find(item => item.displayNo === question.displayNo);
    if (!visionItem) throw new Error('VISION_RESULT_REFERENCE_MISSING');
    const correctedText = answerOverrides.get(`${material.id}:${question.displayNo}`);
    const observedText = correctedText ?? getObservedAnswer(visionItem);
    const recognitionConflict = correctedText === undefined && !visionItem.selectedOption && recognitionTextsConflict(visionItem.paddleText, visionItem.lunaText);
    const objectiveScore = scoreObjectiveChoice(visionItem.selectedOption, question.standardAnswer, question.fullScore);
    const choiceIsCorrect = objectiveScore === null ? undefined : objectiveScore === question.fullScore;
    const matchedPoints = choiceIsCorrect === undefined ? modelSample.matchedPoints : choiceIsCorrect ? question.rubricPoints.map(point => point.point) : [];
    const missedPoints = choiceIsCorrect === undefined ? modelSample.missedPoints : choiceIsCorrect ? [] : question.rubricPoints.map(point => point.point);
    const score = objectiveScore === null
      ? resolveTrialScore(question.fullScore, question.rubricPoints, matchedPoints, missedPoints, modelSample.score)
      : objectiveScore;
    const gradingConfidence = correctedText === undefined ? resolveTrialConfidence(modelSample.confidence, visionItem) : modelSample.confidence;
    const needsTeacherReview = correctedText === undefined ? trialNeedsTeacherReview(modelSample.needsTeacherReview, visionItem) : modelSample.needsTeacherReview;
    const scoreRatio = question.fullScore > 0 && score !== null ? score / question.fullScore : 0;
    const sampleType: CalibrationSample['sampleType'] = needsTeacherReview || gradingConfidence < 0.65 ? 'ocr-risk' : scoreRatio >= 0.8 ? 'high' : scoreRatio <= 0.4 ? 'low' : 'middle';
    return {
      id: `${modelSample.questionId}-${modelSample.assetId}`,
      questionId: modelSample.questionId,
      studentId: submission.studentId,
      studentName: submission.studentName,
      studentNo: submission.studentNo,
      sampleType,
      rawImageDescription: `${material.fileName} · 第 ${question.displayNo} 题截图`,
      rawOcrText: getObservedAnswer(visionItem),
      teacherCorrectedText: correctedText,
      ocrText: observedText,
      lunaReviewText: visionItem.lunaText,
      recognitionConflict,
      ocrSource: visionItem.selectedOption ? 'choice-vision' as const : visionItem.paddleText ? 'paddle' as const : 'luna' as const,
      ocrConfidence: visionItem.confidence,
      aiScore: score,
      fullScore: question.fullScore,
      gradingConfidence,
      needsTeacherReview,
      matchedPoints,
      missedPoints,
      gradingReason: choiceIsCorrect === undefined ? modelSample.reason : choiceIsCorrect ? '识别选项与标准答案一致。' : '识别选项与标准答案不一致。',
      sourceAssetId: material.id,
      sourceFileName: `${material.fileName} · 第 ${question.displayNo} 题`,
      sourcePreviewUrl: visionItem.cropUrl,
      sourcePreviewType: 'image' as const,
      status: 'pending' as const,
      rubricVersion: question.rubricVersion
    } satisfies CalibrationSample;
  });
};
