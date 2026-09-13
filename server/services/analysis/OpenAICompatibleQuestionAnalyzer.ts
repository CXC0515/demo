/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelConfig } from '../../config/modelConfig';
import { extractJson } from '../model/extractJson';
import { firstSectionAnalysisJsonSchema, firstSectionModelOutputSchema, knowledgeCandidateSchema } from '../../schemas/firstSectionAnalysis';
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
  fullText: string;
  blocks: {
    id: string;
    text: string;
    listLabel?: string;
    pageNumber?: number;
    order: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }[];
}

const invalidKnowledgeCandidateReason = '知识点返回格式异常，未自动关联';

const comparableText = (value: string) => value
  .normalize('NFKC')
  .toLocaleLowerCase('zh-CN')
  .replace(/[\s\p{P}\p{S}]/gu, '');

const normalizedSourceSlice = (source: string, candidate: string) => {
  const target = comparableText(candidate);
  if (!target) return '';
  let normalized = '';
  const sourceIndexes: number[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const next = comparableText(source[index]!);
    for (const character of next) {
      normalized += character;
      sourceIndexes.push(index);
    }
  }
  const start = normalized.indexOf(target);
  if (start < 0) return '';
  return source.slice(sourceIndexes[start], (sourceIndexes[start + target.length - 1] ?? source.length - 1) + 1);
};

interface ModelOutputRecovery {
  questionNo: string;
  droppedKnowledgeCandidateCount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const sanitizeRecoverableFirstSectionOutput = (value: unknown) => {
  const recoveries: ModelOutputRecovery[] = [];
  const sanitizeQuestion = (question: unknown): unknown => {
    if (!isRecord(question)) return question;
    const next = { ...question };
    if (Array.isArray(question.knowledgeCandidates)) {
      const knowledgeCandidates = question.knowledgeCandidates.flatMap(candidate => {
        const parsed = knowledgeCandidateSchema.safeParse(candidate);
        return parsed.success ? [parsed.data] : [];
      });
      const droppedKnowledgeCandidateCount = question.knowledgeCandidates.length - knowledgeCandidates.length;
      if (droppedKnowledgeCandidateCount > 0) {
        next.knowledgeCandidates = knowledgeCandidates;
        if (Array.isArray(question.reviewReasons) && question.reviewReasons.every(reason => typeof reason === 'string')) {
          next.reviewReasons = question.reviewReasons.includes(invalidKnowledgeCandidateReason)
            ? [...question.reviewReasons]
            : [...question.reviewReasons, invalidKnowledgeCandidateReason];
        }
        recoveries.push({
          questionNo: typeof question.displayNo === 'string' ? question.displayNo : '',
          droppedKnowledgeCandidateCount
        });
      }
    }
    if (Array.isArray(question.subquestions)) {
      next.subquestions = question.subquestions.map(sanitizeQuestion);
    }
    return next;
  };

  if (!isRecord(value) || !Array.isArray(value.questions)) return { output: value, recoveries };
  return { output: { ...value, questions: value.questions.map(sanitizeQuestion) }, recoveries };
};

export class OpenAICompatibleQuestionAnalyzer {
  constructor(private readonly config: ModelConfig, private readonly fetcher: typeof fetch = fetch) {}

  async analyzeAssignment(materials: StoredMaterial[], knowledgeCatalog: KnowledgeCatalogItem[]) {
    const documents: AnalyzerDocument[] = materials.flatMap(material => material.normalizedDocument ? [{
      assetId: material.id,
      kind: material.kind,
      fileName: material.fileName,
      fullText: material.normalizedDocument.markdown,
      blocks: (material.normalizedDocument?.blocks ?? []).map(block => ({
        id: block.id,
        text: block.listLabel && !block.text.trim().startsWith(block.listLabel) ? `${block.listLabel} ${block.text}` : block.text,
        listLabel: block.listLabel,
        pageNumber: block.pageNumber,
        order: block.order,
        boundingBox: block.boundingBox
      }))
    }] : []);
    const catalog = knowledgeCatalog.map(item => `${item.id}\t${item.type}\t${item.name}\t${item.description}`).join('\n');
    const initial = await this.analyzeDocuments(documents, catalog);
    const initialIssues = this.findSourceIssues(initial, documents);
    let result = initial;
    if (initialIssues.length) {
      try {
        result = await this.analyzeDocuments(documents, catalog, { previous: initial, issues: initialIssues });
      } catch (error) {
        console.warn(JSON.stringify({ event: 'first_section_analysis_correction_failed', error: error instanceof Error ? error.message : String(error) }));
      }
    }
    const blocksByDocument = new Map(documents.map(document => [
      `${document.kind}:${document.assetId}`,
      new Map(document.blocks.map(block => [block.id, block.text]))
    ]));
    const resolveSource = (source: typeof result.questions[number]['questionSource'], displayText: string) => {
      const blocks = blocksByDocument.get(`${source.assetKind}:${source.assetId}`);
      if (!blocks) return null;
      const exactSegments = source.segments.flatMap(segment => {
        const block = blocks.get(segment.blockId);
        return block?.includes(segment.quote) ? [segment] : [];
      });
      if (source.segments.length > 0 && exactSegments.length === source.segments.length) {
        return { ...source, quote: exactSegments.map(segment => segment.quote.trim()).filter(Boolean).join('\n').trim(), segments: exactSegments, matchStatus: 'exact' as const };
      }
      for (const blockId of [...new Set([...source.segments.map(segment => segment.blockId), ...source.blockIds])]) {
        const block = blocks.get(blockId);
        if (!block) continue;
        const matched = normalizedSourceSlice(block, displayText) || normalizedSourceSlice(block, source.quote);
        if (matched) return { ...source, blockIds: [blockId], quote: matched, segments: [{ blockId, quote: matched }], matchStatus: 'normalized' as const };
      }
      const fallbackSegments = [...new Set(source.blockIds)].flatMap(blockId => {
        const quote = blocks.get(blockId);
        return quote ? [{ blockId, quote }] : [];
      });
      return fallbackSegments.length ? {
        ...source,
        blockIds: fallbackSegments.map(segment => segment.blockId),
        quote: fallbackSegments.map(segment => segment.quote).join('\n'),
        segments: fallbackSegments,
        matchStatus: 'block-level' as const
      } : null;
    };
    const useSourceText = <T extends typeof result.questions[number] | typeof result.questions[number]['subquestions'][number]>(question: T): T => {
      const questionSource = resolveSource(question.questionSource, question.stem);
      const answerSource = question.answerSource ? resolveSource(question.answerSource, question.standardAnswer) : null;
      const answerNeedsReview = answerSource?.matchStatus === 'block-level';
      return {
        ...question,
        questionSource: questionSource ?? question.questionSource,
        answerSource,
        reviewReasons: answerNeedsReview
          ? [...new Set([...question.reviewReasons, '答案已识别，来源仅定位到 OCR 文本块，需教师确认'])]
          : question.reviewReasons
      };
    };
    const normalizedQuestions = result.questions.map(question => {
      const subquestions = question.subquestions.map(useSourceText);
      const motherQuestion = useSourceText(question);
      const stem = subquestions.reduce((current, subquestion) => current.replace(subquestion.stem.trim(), '').trim(), motherQuestion.stem)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return { ...motherQuestion, stem: stem || motherQuestion.stem, subquestions };
    });
    const duplicateKeys = new Map<string, string[]>();
    normalizedQuestions.forEach(question => {
      const key = question.answerSource && question.standardAnswer.length > 2
        ? `${question.answerSource.assetId}:${JSON.stringify(question.answerSource.segments)}:${question.standardAnswer}`
        : '';
      if (key) duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), question.displayNo]);
    });
    return {
      scope: '整份作业' as const,
      questions: normalizedQuestions.map(question => {
        const key = question.answerSource && question.standardAnswer.length > 2
          ? `${question.answerSource.assetId}:${JSON.stringify(question.answerSource.segments)}:${question.standardAnswer}`
          : '';
        const duplicates = key ? duplicateKeys.get(key) ?? [] : [];
        if (duplicates.length < 2 || question.reviewReasons.some(reason => reason.includes('答案确实相同'))) return question;
        return { ...question, reviewReasons: [...new Set([...question.reviewReasons, `与第 ${duplicates.filter(no => no !== question.displayNo).join('、')} 题返回了完全相同的答案来源，需教师确认`])] };
      })
    };
  }

  private findSourceIssues(result: Awaited<ReturnType<OpenAICompatibleQuestionAnalyzer['analyzeDocuments']>>, documents: AnalyzerDocument[]) {
    const blocks = new Map(documents.map(document => [
      `${document.kind}:${document.assetId}`,
      new Map(document.blocks.map(block => [block.id, block.text]))
    ]));
    const issues: string[] = [];
    const units = result.questions.flatMap(question => [question, ...question.subquestions]);
    for (const unit of units) {
      for (const [label, source] of [['题目', unit.questionSource], ['答案', unit.answerSource]] as const) {
        if (!source) continue;
        const sourceBlocks = blocks.get(`${source.assetKind}:${source.assetId}`);
        if (!sourceBlocks || !source.segments.length || source.segments.some(segment => !sourceBlocks.get(segment.blockId)?.includes(segment.quote))) {
          issues.push(`第 ${unit.displayNo} 题${label}引用的片段不在指定 OCR block 中`);
        }
      }
    }
    const seen = new Map<string, string>();
    for (const unit of units) {
      if (!unit.answerSource || unit.standardAnswer.length <= 2 || unit.reviewReasons.some(reason => reason.includes('答案确实相同'))) continue;
      const key = `${unit.answerSource.assetId}:${JSON.stringify(unit.answerSource.segments)}:${unit.standardAnswer}`;
      const previous = seen.get(key);
      if (previous) issues.push(`第 ${previous} 题与第 ${unit.displayNo} 题返回了完全相同的答案和来源`);
      else seen.set(key, unit.displayNo);
    }
    return issues;
  }

  private async analyzeDocuments(documents: AnalyzerDocument[], catalog: string, correction?: { previous: unknown; issues: string[] }) {
    const prompt = [
      '你是作业结构化分析器。题目和参考答案材料均已完整提供，请一次完成整份材料的对应。',
      '题目与参考答案的全部 OCR 原文、页面顺序及 block id 都已提供。你负责理解整份材料，识别题号层级、题型、题目与答案对应关系、评分依据和知识点；不得缩写、概括或补写题干与答案，只允许修正纯排版转义。',
      '识别材料中的全部母题，不得按章节、题型或前若干题截断。',
      '母题放在 questions；明确小题放在对应 subquestions。母题 stem 只包含公共材料和公共要求，不得重复已经写入 subquestions 的小题题干。按原题号和原始顺序输出。',
      'subquestions 中每个小题必须返回与母题相同的全部字段：displayNo、title、stem、score、questionType、answerRequirement、standardAnswer、explanation、rubricPoints、knowledgeCandidates、questionSource、answerSource、confidence、reviewReasons。不得使用简写对象；小题来源无法单独定位时沿用母题来源。',
      '每个来源都必须返回 segments，格式为 [{"blockId":"真实 block id","quote":"从该 block 逐字截取的本题片段"}]。一个 block 可以包含多道题，此时每道题引用同一 block 的不同 quote，绝不能把整个 block 当作每道题的答案。',
      'stem 和 standardAnswer 面向教师阅读：保持原意和数学表达，保留可渲染的 LaTeX，不要暴露转义错误；questionSource/answerSource 的 quote 与 segments 则必须逐字引用 OCR 原文。展示文本可以与证据原文存在空格、全半角标点和排版标记差异。无法确定答案内容时 standardAnswer 为空、answerSource 为 null，并写入 reviewReasons，禁止猜测。',
      'standardAnswer 与答案材料按题号对应；答案为“略”时原样保留。rubricPoints 只能依据明确答案、分值或可直接推出的得分要求生成。',
      '同一道题的答案若跨多个 block 或包含多个示例，segments 应依原文顺序引用全部相关片段。不得依据固定题号格式切分，需理解中文数字、罗马数字、带圈序号、字母和无编号题目。',
      '不同题目的答案确实相同时，在两题 reviewReasons 中加入“答案确实相同”；否则不得为不同题目返回完全相同的答案来源。',
      'questionSource/answerSource 中 assetId、fileName、blockIds 必须引用输入中真实值；无法定位答案时 answerSource 为 null。',
      '知识点只能使用资源库中的真实 nodeId；没有合适节点时返回空数组。所有 confidence 取 0 到 1。',
      'knowledgeCandidates 非空时必须返回对象数组，例如 [{"nodeId":"资源库中的真实ID","nodeName":"对应节点名称","confidence":0.8}]；禁止返回 ["知识点名称"] 这类字符串数组。',
      '严格返回以下字段结构：{"scope":"整份作业","questions":[{"displayNo":"一","title":"","stem":"","score":0,"questionType":"","answerRequirement":"","standardAnswer":"","explanation":"","rubricPoints":[{"point":"","score":0,"description":""}],"knowledgeCandidates":[],"questionSource":{"assetKind":"assignment","assetId":"","fileName":"","blockIds":[],"quote":"","segments":[{"blockId":"","quote":""}]},"answerSource":null,"confidence":0,"reviewReasons":[],"subquestions":[]}]}。',
      `资源库节点：\n${catalog || '（当前没有可用资源节点）'}`,
      `材料：\n${JSON.stringify(documents)}`,
      ...(correction ? [
        `上一次结果存在以下来源一致性问题：\n${correction.issues.join('\n')}`,
        `请基于完整材料重新返回整份结果，只修正有问题的对应关系，不得重复错误：\n${JSON.stringify(correction.previous)}`
      ] : [])
    ].join('\n\n');

    const response = await this.fetcher(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.visionModel,
        messages: [
          { role: 'system', content: '只返回符合要求的 JSON，不要输出解释性文字。' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'first_section_analysis', strict: true, schema: firstSectionAnalysisJsonSchema } },
        reasoning_effort: 'medium'
      }),
      signal: AbortSignal.timeout(300_000)
    });
    if (!response.ok) throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('MODEL_EMPTY_RESPONSE');
    const { output, recoveries } = sanitizeRecoverableFirstSectionOutput(extractJson(content));
    if (recoveries.length) {
      console.warn(JSON.stringify({ event: 'first_section_analysis_output_recovered', recoveries }));
    }
    return firstSectionModelOutputSchema.parse(output);
  }
}
