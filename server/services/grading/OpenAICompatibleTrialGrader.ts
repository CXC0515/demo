/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelConfig } from '../../config/modelConfig';
import { StoredMaterial } from '../../repositories/materialRepository';
import { getVisionValidationResult } from '../../repositories/visionValidationRepository';
import { trialGradingModelOutputSchema, TrialGradingRequest } from '../../schemas/trialGrading';

const extractJson = (value: string) => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse((fenced ?? value).trim());
};

export class OpenAICompatibleTrialGrader {
  constructor(private readonly config: ModelConfig) {}

  async grade(taskId: string, request: TrialGradingRequest, materials: StoredMaterial[]) {
    const submissionById = new Map(request.submissions.map(item => [item.assetId, item]));
    const submissions = materials.flatMap(material => {
      const student = submissionById.get(material.id);
      if (!student || material.kind !== 'student-submission' || !material.normalizedDocument) return [];
      return [{
        assetId: material.id,
        studentName: student.studentName,
        studentNo: student.studentNo,
        recognizedAnswers: (getVisionValidationResult(taskId, material.id)?.items ?? []).map(item => ({
          displayNo: item.displayNo,
          answer: item.lunaText || item.selectedOption || '',
          answerFields: item.answerFields ?? [],
          crossedOutText: item.crossedOutText,
          confidence: item.confidence,
          needsReview: item.needsReview || item.locationStatus !== 'located'
        }))
      }];
    });
    const prompt = [
      '你是语文教师的试批助手。依据已确认的题目、标准答案、采分点和教师规则，逐题评阅每份学生答卷的第一部分。',
      '只评价学生作答内容。答题卡上已有的分数、打勾、批注、阅卷痕迹和题旁数字都不是评分依据，必须忽略。',
      '只使用 recognizedAnswers 中已按题裁图识别的答案。不得引用整页 OCR，不得把相邻题答案混入，也不得补写学生未作答的内容。',
      'crossedOutText 是学生明确划掉的内容，评分时必须排除。recognizedAnswers 标记 needsReview 时，评分结果也必须 needsTeacherReview=true。',
      'score 必须在 0 到 fullScore 之间。标准答案或采分依据不足以可靠评分时，score 返回 null、needsTeacherReview=true，并说明缺少什么依据。',
      'matchedPoints 和 missedPoints 必须对应输入采分点；没有明确采分点时保持空数组。confidence 取 0 到 1。',
      '必须为每个 questionId 与 assetId 组合返回一条结果，不得遗漏。',
      '严格返回 JSON：{"samples":[{"questionId":"","assetId":"","studentAnswer":"","score":0,"confidence":0,"matchedPoints":[],"missedPoints":[],"reason":"","needsTeacherReview":false}]}。',
      `题目与评分依据：\n${JSON.stringify(request.questions)}`,
      `学生逐题视觉识别：\n${JSON.stringify(submissions)}`
    ].join('\n\n');

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
