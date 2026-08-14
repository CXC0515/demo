/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelConfig } from '../../config/modelConfig';
import { StoredMaterial } from '../../repositories/materialRepository';
import { getVisionValidationResult } from '../../repositories/visionValidationRepository';
import { trialGradingModelOutputSchema, TrialGradingRequest } from '../../schemas/trialGrading';
import { VisionValidationItem } from '../../../src/domain/types';
import { formatPaddleTextForDisplay, recognitionTextsConflict } from './trialScore';
import { extractJson } from '../model/extractJson';

export const buildTrialAnswerEvidence = (item: VisionValidationItem) => {
  const paddleAnswer = formatPaddleTextForDisplay(item.paddleText);
  const recognitionConflict = !item.selectedOption && recognitionTextsConflict(item.paddleText, item.lunaText);
  return {
    displayNo: item.displayNo,
    answer: item.selectedOption || paddleAnswer || item.lunaText,
    paddleAnswer,
    lunaReview: item.lunaText,
    recognitionConflict,
    crossedOutText: item.crossedOutText,
    existingMarkings: item.existingMarkings,
    confidence: item.confidence,
    needsReview: item.needsReview || item.locationStatus !== 'located' || recognitionConflict
  };
};

export const buildTrialGradingPrompt = (request: TrialGradingRequest, submissions: unknown[]) => [
  '你是教师的试批助手。依据已确认的题目、标准答案、采分点和教师规则，逐题评阅每份学生答卷中本次选定的题目。',
  '只评价学生作答内容。答题卡上已有的分数、打勾、批注、阅卷痕迹和题旁数字都不是评分依据，必须忽略。',
  '只使用 recognizedAnswers 中已按题裁图识别的答案。不得引用整页 OCR，不得把相邻题答案混入，也不得补写学生未作答的内容。',
  'answer 与 paddleAnswer 是 PaddleOCR 主证据，评分默认以它们为准；lunaReview 只能作为视觉复核，不能静默覆盖 PaddleOCR。',
  'crossedOutText 是 Luna 从图片确认的划掉内容，评分时必须从主证据中排除。existingMarkings 是已有分数、勾叉或批注，必须忽略。',
  'recognitionConflict=true 表示两路证据有实质差异：仍须依据 PaddleOCR 主证据给出暂定分数，同时 needsTeacherReview=true，并在 reason 中说明冲突，不得因为冲突直接返回 null。',
  '只要 answer 非空且评分依据足够，score 必须是 0 到 fullScore 之间的数字；只有主证据为空或评分依据本身不足时才可返回 null。',
  'recognizedAnswers 标记 needsReview 时，评分结果也必须 needsTeacherReview=true，但 needsReview 本身不能成为拒绝给暂定分数的理由。',
  'score 必须在 0 到 fullScore 之间。标准答案或采分依据不足以可靠评分时，score 返回 null、needsTeacherReview=true，并说明缺少什么依据。',
  'matchedPoints 和 missedPoints 必须对应输入采分点；没有明确采分点时保持空数组。confidence 取 0 到 1。',
  '必须为每个 questionId 与 assetId 组合返回一条结果，不得遗漏。',
  '你只负责评分，不得转写、纠正或输出学生答案。',
  '严格返回 JSON：{"samples":[{"questionId":"","assetId":"","score":0,"confidence":0,"matchedPoints":[],"missedPoints":[],"reason":"","needsTeacherReview":false}]}。',
  `题目与评分依据：\n${JSON.stringify(request.questions)}`,
  `学生逐题视觉识别：\n${JSON.stringify(submissions)}`
].join('\n\n');

export class OpenAICompatibleTrialGrader {
  constructor(private readonly config: ModelConfig) {}

  async grade(taskId: string, request: TrialGradingRequest, materials: StoredMaterial[], answerOverrides = new Map<string, string>()) {
    const submissionById = new Map(request.submissions.map(item => [item.assetId, item]));
    const requestedQuestionNos = new Set(request.questions.map(item => item.displayNo));
    const submissions = materials.flatMap(material => {
      const student = submissionById.get(material.id);
      if (!student || material.kind !== 'student-submission' || !material.normalizedDocument) return [];
      return [{
        assetId: material.id,
        studentName: student.studentName,
        studentNo: student.studentNo,
        recognizedAnswers: (getVisionValidationResult(taskId, material.id)?.items ?? []).filter(item => requestedQuestionNos.has(item.displayNo)).map(item => {
          const evidence = buildTrialAnswerEvidence(item);
          const corrected = answerOverrides.get(`${material.id}:${item.displayNo}`);
          return corrected === undefined ? evidence : { ...evidence, answer: corrected, paddleAnswer: corrected, recognitionConflict: false, needsReview: false };
        })
      }];
    });
    const prompt = buildTrialGradingPrompt(request, submissions);

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.visionModel,
        messages: [
          { role: 'system', content: '只返回符合要求的 JSON，不要输出解释性文字。' },
          { role: 'user', content: prompt }
        ],
        reasoning_effort: 'low'
      }),
      signal: AbortSignal.timeout(240_000)
    });
    if (!response.ok) throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('MODEL_EMPTY_RESPONSE');
    return trialGradingModelOutputSchema.parse(extractJson(content));
  }
}
