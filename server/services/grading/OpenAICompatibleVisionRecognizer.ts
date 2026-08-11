/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import { ModelConfig } from '../../config/modelConfig';
import { visionRecognitionOutputSchema } from '../../schemas/paddleParserArtifact';
import { LocatedRegion } from './questionRegionCropper';

const extractJson = (value: string) => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse((fenced ?? value).trim());
};

export class OpenAICompatibleVisionRecognizer {
  constructor(private readonly config: ModelConfig) {}

  async recognize(regions: LocatedRegion[]) {
    const content: Array<Record<string, unknown>> = [{
      type: 'text',
      text: [
        '你是无上下文的答题证据逐字转写器。每张图片是一道题的完整作答区域，不提供题干和标准答案。',
        '你的唯一任务是报告图片中实际可见的字、符号、公式、选项或图形信息。禁止根据常识、诗文、语法、固定搭配或学科知识补全和纠正。',
        '字形不能确认时写“[看不清]”，confidence 降低并 needsReview=true；空白证据必须返回空字符串，不得猜答案。',
        '划掉内容仅放入 crossedOutText。教师分数、勾叉和批注仅放入 existingMarkings。',
        '按照图片中实际可见的题号、圈号和上下顺序对应 evidenceId。evidenceId 以“-answer”结尾时写入 recognizedAnswer；其他 evidenceId 原样写入 answerFields.fieldId。',
        'selectedOption 仅用于确实可见的选择题填涂。visualEvidence 只描述可见笔迹，不解释题意。',
        '严格返回 JSON：{"items":[{"displayNo":"2","recognizedAnswer":"","answerFields":[{"fieldId":"2-1","text":"","crossedOutText":[],"confidence":0,"needsReview":false}],"crossedOutText":[],"selectedOption":null,"visualEvidence":"","existingMarkings":[],"confidence":0,"needsReview":false}]}。'
      ].join('\n')
    }];
    for (const region of regions) {
      content.push({
        type: 'text',
        text: `题组 ${region.displayNo}；待转写字段：${JSON.stringify(region.evidenceUnits.map(unit => ({ evidenceId: unit.evidenceId, kind: unit.kind })))}`
      });
      const image = await readFile(region.cropPath);
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}`, detail: 'high' } });
    }
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.visionModel,
        messages: [{ role: 'user', content }],
        reasoning_effort: 'low'
      }),
      signal: AbortSignal.timeout(240_000)
    });
    if (!response.ok) throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const responseContent = payload.choices?.[0]?.message?.content;
    if (!responseContent) throw new Error('MODEL_EMPTY_RESPONSE');
    const parsed = visionRecognitionOutputSchema.parse(extractJson(responseContent));
    const regionByNo = new Map(regions.map(region => [region.displayNo, region]));
    return {
      items: parsed.items.filter(item => regionByNo.has(item.displayNo)).map(item => {
        const region = regionByNo.get(item.displayNo);
        const expectedFieldIds = region?.evidenceUnits
          .filter(unit => unit.kind !== 'choice')
          .map(unit => unit.evidenceId)
          .filter(id => !id.endsWith('-answer')) ?? [];
        const returnedById = new Map(item.answerFields.map(field => [field.fieldId, field]));
        const answerFields = expectedFieldIds.map(fieldId => returnedById.get(fieldId) ?? {
          fieldId,
          text: '',
          crossedOutText: [],
          confidence: 0,
          needsReview: true
        });
        const incomplete = expectedFieldIds.some(fieldId => !returnedById.has(fieldId));
        return {
          ...item,
          answerFields,
          needsReview: item.needsReview || incomplete || answerFields.some(field => field.needsReview)
        };
      })
    };
  }
}
