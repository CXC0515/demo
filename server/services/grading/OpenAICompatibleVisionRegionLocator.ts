/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import { FirstSectionAnalysis } from '../../../src/domain/types';
import { ModelConfig } from '../../config/modelConfig';
import { visionRegionLocatorOutputSchema } from '../../schemas/paddleParserArtifact';
import { extractJson } from '../model/extractJson';

interface EvidencePageInput {
  pageNumber: number;
  sourceImagePath: string;
  blocks: Array<{
    blockId: string;
    order: number;
    text: string;
    boundingBox: { x: number; y: number; width: number; height: number };
  }>;
}

export class OpenAICompatibleVisionRegionLocator {
  constructor(private readonly config: ModelConfig, private readonly fetcher: typeof fetch = fetch) {}

  async locatePages(pages: EvidencePageInput[], questionNos: string[], analysis: FirstSectionAnalysis) {
    const questions = analysis.questions
      .filter(question => questionNos.includes(question.displayNo))
      .map(question => ({
        displayNo: question.displayNo,
        stem: question.stem,
        subquestions: question.subquestions.map(unit => ({ displayNo: unit.displayNo, stem: unit.stem }))
      }));
    const content: Array<Record<string, unknown>> = [{
      type: 'text',
      text: [
        '你负责一次完成整份学生答卷的题目归属、答案区域定位和原样转写，不评分，也不能看到或推测标准答案。',
        '结合所有页面原图、PaddleOCR block 的文字和坐标以及题目结构，为每个待识别题号返回且只返回一项。',
        'recognizedAnswer 按图片原有顺序逐字记录学生作答。PaddleOCR 只是候选；禁止按题意、常识或固定搭配补全和纠正。',
        'boundingBox 仅用于大题截图，必须覆盖该大题全部实际作答但不得包含相邻题。无法可靠截图时 screenshotAvailable=false；此时不要为了截图扩大范围。',
        'blockIds 继续记录与视觉证据相关的真实 OCR blockId。划掉内容只放 crossedOutText，教师勾叉、分数和批注只放 existingMarkings。',
        '选择题确有可见选择时填写 selectedOption；非选择题为 null。看不清写“[看不清]”并 needsReview=true。',
        '每题只返回一个 evidenceUnit，evidenceId 使用“题号-answer”，区域与题目 boundingBox 相同；provisionalText 使用对应 OCR 候选，不得编造。',
        '缺失或无法定位的题目也必须返回：recognizedAnswer 为空、screenshotAvailable=false、confidence 降低并 needsReview=true，reason 说明原因；不得遗漏后让系统自动再次调用。',
        `待识别题目：${JSON.stringify(questions)}`,
        '严格返回 JSON：{"items":[{"displayNo":"4","pageNumber":1,"boundingBox":{"x":0,"y":0,"width":0.1,"height":0.1},"screenshotAvailable":true,"evidenceUnits":[{"evidenceId":"4-answer","kind":"text","boundingBox":{"x":0,"y":0,"width":0.1,"height":0.1},"provisionalText":"","blockIds":["page-1-block-8"],"confidence":0,"needsReview":false,"reason":""}],"recognizedAnswer":"","crossedOutText":[],"selectedOption":null,"visualEvidence":"","existingMarkings":[],"confidence":0,"needsReview":false,"reason":""}]}'
      ].join('\n')
    }];
    for (const page of pages) {
      content.push({ type: 'text', text: `第 ${page.pageNumber} 页 PaddleOCR blocks：${JSON.stringify(page.blocks)}` });
      const image = await readFile(page.sourceImagePath);
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}`, detail: 'high' } });
    }
    const response = await this.fetcher(`${this.config.baseUrl}/chat/completions`, {
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
    return visionRegionLocatorOutputSchema.parse(extractJson(responseContent));
  }
}
