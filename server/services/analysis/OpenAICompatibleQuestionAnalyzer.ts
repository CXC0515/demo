/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelConfig } from '../../config/modelConfig';
import { extractJson } from '../model/extractJson';
import { firstSectionModelOutputSchema } from '../../schemas/firstSectionAnalysis';
import { StoredMaterial } from '../../repositories/materialRepository';

interface KnowledgeCatalogItem {
  id: string;
  name: string;
  type: string;
  description: string;
}


export class OpenAICompatibleQuestionAnalyzer {
  constructor(private readonly config: ModelConfig) {}

  async analyzeAssignment(materials: StoredMaterial[], knowledgeCatalog: KnowledgeCatalogItem[]) {
    const documents = materials.flatMap(material => material.normalizedDocument ? [{
      assetId: material.id,
      kind: material.kind,
      fileName: material.fileName,
      blocks: (material.normalizedDocument?.blocks ?? []).map(block => ({ id: block.id, text: block.text }))
    }] : []);
    const catalog = knowledgeCatalog.map(item => `${item.id}\t${item.type}\t${item.name}\t${item.description}`).join('\n');
    const prompt = [
      '你是作业结构化分析器。分析输入中的整份题目材料，不得只截取第一部分。',
      '必须识别整份作业的全部一级题及其明确子题。一级题放在 questions；子题放在对应 subquestions。按原题号和原始顺序输出，不得遗漏后续部分。',
      '题干、答案和证据 quote 必须来自输入原文。无法确定时保留空字符串或 null，并写入 reviewReasons，禁止猜测。',
      'standardAnswer 与答案材料按题号对应；答案为“略”时原样保留。rubricPoints 只能依据明确答案、分值或可直接推出的得分要求生成。',
      '同一道题的答案若由连续多个段落或多个示例组成，standardAnswer、answerSource.blockIds 和 answerSource.quote 必须包含下一道题开始前的全部内容，不得只取第一段或第一个示例。',
      'questionSource/answerSource 中 assetId、fileName、blockIds 必须引用输入中真实值；无法定位答案时 answerSource 为 null。',
      '知识点只能使用资源库中的真实 nodeId；没有合适节点时返回空数组。所有 confidence 取 0 到 1。',
      '严格返回以下字段结构：{"scope":"整份作业","questions":[{"displayNo":"1","title":"","stem":"","score":0,"questionType":"","answerRequirement":"","standardAnswer":"","explanation":"","rubricPoints":[{"point":"","score":0,"description":""}],"knowledgeCandidates":[],"questionSource":{"assetKind":"assignment","assetId":"","fileName":"","blockIds":[],"quote":""},"answerSource":null,"confidence":0,"reviewReasons":[],"subquestions":[]}]}。',
      `资源库节点：\n${catalog || '（当前没有可用资源节点）'}`,
      `材料：\n${JSON.stringify(documents)}`
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
      signal: AbortSignal.timeout(180_000)
    });
    if (!response.ok) throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('MODEL_EMPTY_RESPONSE');
    return firstSectionModelOutputSchema.parse(extractJson(content));
  }
}
