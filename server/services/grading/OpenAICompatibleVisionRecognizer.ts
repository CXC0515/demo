/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import { ModelConfig } from '../../config/modelConfig';
import { VisionRecognitionOutput, visionRecognitionOutputSchema } from '../../schemas/paddleParserArtifact';
import { LocatedRegion } from './questionRegionCropper';
import { extractJson } from '../model/extractJson';

export const getWholeQuestionAnswer = (recognizedAnswer: string, answerFields: Array<{ text: string }>) =>
  recognizedAnswer.trim() || [...new Set(answerFields.map(field => field.text.trim()).filter(Boolean))].join('\n');

export const bindSingleRegionIdentity = <T extends { displayNo: string }>(items: T[], regions: LocatedRegion[]) =>
  items.length === 1 && regions.length === 1 ? [{ ...items[0], displayNo: regions[0].displayNo }] : items;

export const buildRecognitionRegionPrompt = (region: LocatedRegion) => {
  const isChoice = region.evidenceUnits.length > 0 && region.evidenceUnits.every(unit => unit.kind === 'choice');
  const choiceCandidates = region.evidenceUnits
    .filter(unit => unit.kind === 'choice')
    .map(unit => ({ evidenceId: unit.evidenceId, kind: unit.kind, paddleText: unit.paddleText }));
  return [
    `题组 ${region.displayNo}`,
    `PP-OCRv6 逐行候选：${JSON.stringify(region.ocrV6Text ?? '')}`,
    `PaddleOCR-VL 完整候选：${JSON.stringify(region.vlText ?? region.paddleText)}`,
    isChoice
      ? '这是选择题，请返回 selectedOption，answerFields 保持空数组'
      : '这是非选择题，请按图片原有行序将整题作答写入 recognizedAnswer，answerFields 保持空数组；不要拆分到逐空字段',
    ...(choiceCandidates.length ? [`选择题候选：${JSON.stringify(choiceCandidates)}`] : [])
  ].join('；');
};

export const visionRecognitionInstructions = [
  '你是无标准答案的答题证据复核器。每张图片是一道题的完整作答区域，并提供 PP-OCRv6 逐行候选和 PaddleOCR-VL 完整候选。',
  'PP-OCRv6 主要提供逐行原字证据，PaddleOCR-VL 主要提供内容完整性；先比较两者，再对照图片报告实际可见的字、符号、公式、选项或图形信息。禁止根据常识、诗文、语法、固定搭配或学科知识补全和纠正。',
  '两路 Paddle 结果都只是候选而不是事实，可能有重复字、漏字、错字或上下行错序。必须独立看图核验，尤其不要机械复述连续重复的短答案。',
  '候选与图片一致时原样确认；确有字形差异时按图片逐字返回；不能确认时写“[看不清]”并标记 needsReview，不得为了语句通顺改写。',
  '字形不能确认时写“[看不清]”，confidence 降低并 needsReview=true；空白证据必须返回空字符串，不得猜答案。',
  '划掉内容仅放入 crossedOutText。教师分数、勾叉和批注仅放入 existingMarkings；形如“题号(小题):分数”的数字、写在答题区侧边的得分、勾、叉都不得写入 recognizedAnswer。',
  '非选择题只返回一份按图片原有行序排列的整题 recognizedAnswer，answerFields 必须为空；不得把同一行复制到多个字段。',
  'selectedOption 仅用于确实可见的选择题填涂。visualEvidence 只描述可见笔迹，不解释题意。',
  '少量错字、漏字、标点差异、同题内行序变化、涂改痕迹或字形不确定都属于正常 OCR 冲突，只设置 needsReview=true，requiresFocusedOcr 必须为 false。',
  '两路候选有少量差异属于正常情况。只有 PaddleOCR-VL 候选出现图片中不存在的整段内容，或明显混入其他题号、其他题答案、作文段落等跨题结构性内容时，requiresFocusedOcr=true。不得仅因答案含义不同或个别文字不一致触发。',
  '严格返回 JSON：{"items":[{"displayNo":"2","recognizedAnswer":"按图片行序排列的整题作答","answerFields":[],"crossedOutText":[],"selectedOption":null,"visualEvidence":"","existingMarkings":[],"confidence":0,"needsReview":false,"requiresFocusedOcr":false}]}。'
].join('\n');

export class OpenAICompatibleVisionRecognizer {
  constructor(private readonly config: ModelConfig) {}

  async recognize(regions: LocatedRegion[], retryMissing = true): Promise<VisionRecognitionOutput> {
    const content: Array<Record<string, unknown>> = [{
      type: 'text',
      text: visionRecognitionInstructions
    }];
    for (const region of regions) {
      content.push({
        type: 'text',
        text: buildRecognitionRegionPrompt(region)
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
    const parsedItems = bindSingleRegionIdentity(parsed.items, regions);
    const regionByNo = new Map(regions.map(region => [region.displayNo, region]));
    const returnedNumbers = new Set(parsedItems.map(item => item.displayNo));
    const missingNumbers = regions.map(region => region.displayNo).filter(displayNo => !returnedNumbers.has(displayNo));
    const retriedItems = missingNumbers.length && retryMissing
      ? (await this.recognize(regions.filter(region => missingNumbers.includes(region.displayNo)), false)).items
      : [];
    const allItems = [...parsedItems, ...retriedItems];
    const completedNumbers = new Set(allItems.map(item => item.displayNo));
    const stillMissing = regions.map(region => region.displayNo).filter(displayNo => !completedNumbers.has(displayNo));
    if (stillMissing.length) throw new Error(`VISION_RECOGNITION_INCOMPLETE:${stillMissing.join(',')}`);
    return {
      items: allItems.filter(item => regionByNo.has(item.displayNo)).map(item => {
        const recognizedAnswer = getWholeQuestionAnswer(item.recognizedAnswer, item.answerFields);
        return {
          ...item,
          recognizedAnswer,
          answerFields: [],
          needsReview: item.needsReview || (!item.selectedOption && !recognizedAnswer)
        };
      })
    };
  }
}
