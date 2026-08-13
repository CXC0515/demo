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

interface AnalyzerDocument {
  assetId: string;
  kind: StoredMaterial['kind'];
  fileName: string;
  blocks: { id: string; text: string; listLabel?: string }[];
}

export class OpenAICompatibleQuestionAnalyzer {
  constructor(private readonly config: ModelConfig) {}

  async analyzeAssignment(materials: StoredMaterial[], knowledgeCatalog: KnowledgeCatalogItem[]) {
    const documents: AnalyzerDocument[] = materials.flatMap(material => material.normalizedDocument ? [{
      assetId: material.id,
      kind: material.kind,
      fileName: material.fileName,
      blocks: (material.normalizedDocument?.blocks ?? []).map(block => ({
        id: block.id,
        text: block.listLabel && !block.text.trim().startsWith(block.listLabel) ? `${block.listLabel} ${block.text}` : block.text,
        listLabel: block.listLabel
      }))
    }] : []);
    const catalog = knowledgeCatalog.map(item => `${item.id}\t${item.type}\t${item.name}\t${item.description}`).join('\n');
    const result = await this.analyzeDocuments(documents, catalog);
    const blocksByDocument = new Map(documents.map(document => [
      `${document.kind}:${document.assetId}`,
      new Map(document.blocks.map(block => [block.id, block.text]))
    ]));
    const authoritativeQuote = (source: typeof result.questions[number]['questionSource']) => {
      if (!source) return '';
      const blocks = blocksByDocument.get(`${source.assetKind}:${source.assetId}`);
      const quote = source.blockIds.map(id => blocks?.get(id)).filter((text): text is string => Boolean(text?.trim())).join('\n').trim();
      return quote || source.quote.trim();
    };
    const useSourceText = <T extends typeof result.questions[number] | typeof result.questions[number]['subquestions'][number]>(question: T): T => {
      const questionQuote = authoritativeQuote(question.questionSource);
      const answerQuote = question.answerSource ? authoritativeQuote(question.answerSource) : '';
      return {
        ...question,
        stem: questionQuote || question.stem,
        standardAnswer: answerQuote || question.standardAnswer,
        questionSource: { ...question.questionSource, quote: questionQuote || question.questionSource.quote },
        answerSource: question.answerSource ? { ...question.answerSource, quote: answerQuote || question.answerSource.quote } : null
      };
    };
    return {
      scope: '整份作业' as const,
      questions: result.questions.map(question => ({
        ...useSourceText(question),
        subquestions: question.subquestions.map(useSourceText)
      }))
    };
  }

  private async analyzeDocuments(documents: AnalyzerDocument[], catalog: string) {
    const prompt = [
      '你是作业结构化分析器。题目和参考答案材料均已完整提供，本次只调用一次完成整份材料的对应。',
      '题目原文、参考答案原文及其 block id 是权威数据。你只负责识别题号层级、题型、题目与答案对应关系、评分依据和知识点，不得缩写、概括、润色或补写题干与答案。',
      '识别材料中的全部一级题，不得按章节、题型或前若干题截断。',
      '一级题放在 questions；明确子题放在对应 subquestions。按原题号和原始顺序输出。',
      'subquestions 中每个小题必须返回与一级题相同的全部字段：displayNo、title、stem、score、questionType、answerRequirement、standardAnswer、explanation、rubricPoints、knowledgeCandidates、questionSource、answerSource、confidence、reviewReasons。不得使用简写对象；小题来源无法单独定位时沿用父题来源。',
      'stem 必须逐字复制 questionSource.blockIds 对应的完整原文；standardAnswer 必须逐字复制 answerSource.blockIds 对应的完整原文。无法确定时保留空字符串或 null，并写入 reviewReasons，禁止猜测。',
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
      signal: AbortSignal.timeout(300_000)
    });
    if (!response.ok) throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('MODEL_EMPTY_RESPONSE');
    return firstSectionModelOutputSchema.parse(extractJson(content));
  }
}
