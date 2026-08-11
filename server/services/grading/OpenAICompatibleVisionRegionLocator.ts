/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import { FirstSectionAnalysis } from '../../../src/domain/types';
import { ModelConfig } from '../../config/modelConfig';
import { visionRegionLocatorOutputSchema } from '../../schemas/paddleParserArtifact';
import { buildExpectedAnswerFields } from './answerFieldSchema';

const extractJson = (value: string) => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse((fenced ?? value).trim());
};

export class OpenAICompatibleVisionRegionLocator {
  constructor(private readonly config: ModelConfig) {}

  async locate(
    sourceImagePath: string,
    questionNos: string[],
    analysis: FirstSectionAnalysis,
    layoutHints: Array<{
      text: string;
      boundingBox: { x: number; y: number; width: number; height: number };
    }> = []
  ) {
    const questions = analysis.questions
      .filter(question => questionNos.includes(question.displayNo))
      .map(question => {
        const fields = buildExpectedAnswerFields(question);
        return {
          displayNo: question.displayNo,
          stem: question.stem,
          subquestions: question.subquestions.map(unit => ({ displayNo: unit.displayNo, stem: unit.stem })),
          expectedEvidence: fields.length ? fields.map(field => ({ evidenceId: field.fieldId, label: field.label, source: field.stem })) : [{ evidenceId: `${question.displayNo}-answer`, label: '完整作答', source: question.stem }]
        };
      });
    const image = await readFile(sourceImagePath);
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.visionModel,
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: [
              '你负责从整张答题卡建立题目与学生作答证据的对应关系，不评分、不使用标准答案纠正学生。',
              '每题 boundingBox 必须包含题号以及该题全部手写、填涂、划除内容，不得包含相邻题目。',
              'evidenceUnits 只框学生实际作答，不要框题干、印刷提示、教师分数、勾叉或批注。填空题每个空单独框；开放题将连续作答区作为一个证据单元。',
              'evidenceId 必须来自 expectedEvidence。一个答案跨多行时，boundingBox 必须覆盖全部行；不能把续行误分给另一个 evidenceId。',
              '选择题的 evidenceUnits 必须框住该题从题号到全部选项的完整一行，不能只框涂黑方块。题号相邻时必须以图片中真实题号核对纵坐标，不能按顺序猜测。',
              'kind 只能是 text、choice、formula、diagram、table、mixed。',
              'provisionalText 只做页级原样识别候选，不得按题意、诗文、常见搭配或知识补全。看不清可为空并 needsReview=true。',
              '所有 boundingBox 使用相对整页的 0 到 1 坐标。题目或证据无法可靠定位时 confidence 降低、needsReview=true 并说明原因。页面不存在的题目不要返回。',
              '题目级 needsReview 只表示区域坐标是否不可靠；字迹难认只标记对应 evidenceUnits.needsReview，不得因此降低题目定位状态。',
              `待定位题目：${JSON.stringify(questions)}`,
              layoutHints.length ? `Paddle 原始版面块（坐标可信，文字和返回顺序可能有误；单题块优先沿用，合并块才在块内拆分）：${JSON.stringify(layoutHints)}` : '',
              '严格返回 JSON：{"items":[{"displayNo":"4","boundingBox":{"x":0,"y":0,"width":0.1,"height":0.1},"evidenceUnits":[{"evidenceId":"4-answer","kind":"choice","boundingBox":{"x":0,"y":0,"width":0.1,"height":0.1},"provisionalText":"B","confidence":0,"needsReview":false,"reason":""}],"confidence":0,"needsReview":false,"reason":""}]}'
            ].join('\n')
          }, {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}`, detail: 'high' }
          }]
        }],
        reasoning_effort: 'low'
      }),
      signal: AbortSignal.timeout(240_000)
    });
    if (!response.ok) throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('MODEL_EMPTY_RESPONSE');
    return visionRegionLocatorOutputSchema.parse(extractJson(content));
  }
}
