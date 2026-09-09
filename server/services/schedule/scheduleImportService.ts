/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ScheduleItem } from '../../../src/domain/types';
import { getDocumentParserConfig } from '../../config/documentParserConfig';
import { getModelConfig, isModelConfigured, ModelConfig } from '../../config/modelConfig';
import { listClasses } from '../../repositories/rosterRepository';
import { PaddleVisionMaterialParser } from '../materials/PaddleVisionMaterialParser';
import { MaterialParser, MaterialParserError, MaterialParserInput } from '../materials/MaterialParser';
import { enhanceRecognitionPage } from '../materials/recognitionImagePreprocessor';
import { extractJson } from '../model/extractJson';
import { matchScheduleClass, normalizeClassLabel, ScheduleClassMatch } from './classEntityMatcher';

const classCorrectionTypeSchema = z.enum(['exact', 'format-normalized', 'noise-removed', 'ocr-corrected', 'uncertain']);

const resultSchema = z.object({
  items: z.array(z.object({
    day: z.number().int().min(1).max(7),
    period: z.number().int().min(1).max(12),
    title: z.string().trim().min(1).max(120),
    time: z.string().trim().max(80).default('待确认'),
    recognizedClassText: z.string().trim().max(160).default(''),
    classCandidateKey: z.string().trim().max(20).default(''),
    classCorrectionType: classCorrectionTypeSchema.default('uncertain'),
    classNeedsReview: z.boolean().default(false),
    teacherName: z.string().trim().max(80).default(''),
    confidence: z.number().min(0).max(1).default(0.7)
  })).max(200),
  warnings: z.array(z.string().max(300)).max(30).default([])
});

const mappingRetrySchema = z.object({
  mappings: z.array(z.object({
    key: z.string().trim().min(1).max(20),
    classCandidateKey: z.string().trim().max(20).default(''),
    classCorrectionType: classCorrectionTypeSchema.default('uncertain'),
    confidence: z.number().min(0).max(1).default(0.7),
    needsReview: z.boolean().default(false),
  })).max(100),
});

type ClassCorrectionType = z.infer<typeof classCorrectionTypeSchema>;
const transientModelStatuses = new Set([502, 503, 504]);
const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const modelRetryDelaysMs = [1_000, 3_000];
const paddleRetryDelaysMs = [5_000, 15_000];

export const requestScheduleModel = async (
  prompt: string,
  config: ModelConfig,
  fetcher: typeof fetch = fetch,
  wait: (milliseconds: number) => Promise<unknown> = pause,
) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetcher(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.visionModel,
          messages: [{ role: 'system', content: '只返回符合要求的 JSON，不输出解释。' }, { role: 'user', content: prompt }],
          reasoning_effort: 'low'
        }),
        signal: AbortSignal.timeout(300_000)
      });
      if (!response.ok) {
        if (transientModelStatuses.has(response.status) && attempt < 3) {
          await wait(modelRetryDelaysMs[attempt - 1]);
          continue;
        }
        throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
      }
      const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error('MODEL_EMPTY_RESPONSE');
      return { content, retryCount: attempt - 1 };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('MODEL_')) throw error;
      if (attempt < 3) {
        await wait(modelRetryDelaysMs[attempt - 1]);
        continue;
      }
      throw new Error('MODEL_CONNECTION_FAILED', { cause: error });
    }
  }
  throw new Error('MODEL_CONNECTION_FAILED');
};

const isPaddleQueueFull = (error: unknown) => error instanceof MaterialParserError
  && error.code === 'PADDLEOCR_INVALID_REQUEST'
  && error.cause instanceof Error
  && error.cause.message.includes('任务提交队列已满');

export const parseScheduleWithRetry = async (
  parser: Pick<MaterialParser, 'parse'>,
  input: MaterialParserInput,
  wait: (milliseconds: number) => Promise<unknown> = pause,
) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return { document: await parser.parse(input), retryCount: attempt - 1 };
    } catch (error) {
      const retryable = isPaddleQueueFull(error)
        || (error instanceof MaterialParserError && ['PADDLEOCR_RATE_LIMITED', 'PADDLEOCR_TIMEOUT', 'PADDLEOCR_PARSE_FAILED'].includes(error.code));
      if (!retryable || attempt === 3) {
        if (isPaddleQueueFull(error)) throw new MaterialParserError('PADDLEOCR_QUEUE_FULL', { cause: error });
        throw error;
      }
      await wait(paddleRetryDelaysMs[attempt - 1]);
    }
  }
  throw new MaterialParserError('PADDLEOCR_PARSE_FAILED');
};

export const normalizeScheduleCellText = (value: string) => value
  .normalize('NFKC')
  .replace(/\$\s*\^\s*\{\s*(?:\\\*|\\ast|\\star|\*)\s*\}\s*\$/gi, '*')
  .replace(/\$\s*(?:\\\*|\\ast|\\star|\*)\s*\$/gi, '*')
  .replace(/\^\s*\{\s*(?:\\\*|\\ast|\\star|\*)\s*\}/gi, '*')
  .replace(/\\(?:ast|star)\b/gi, '*')
  .replace(/\\([*#])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

export interface ScheduleImportInput {
  assetId: string;
  fileName: string;
  mimeType: string;
  filePath: string;
  scope: 'teacher' | 'class';
  classId: string;
}

export const structureScheduleText = async (
  text: string,
  input: Pick<ScheduleImportInput, 'scope' | 'classId'>,
  config: ModelConfig = getModelConfig(),
  fetcher: typeof fetch = fetch
) => {
  if (!isModelConfigured(config)) throw new Error('MODEL_NOT_CONFIGURED');
  const classes = listClasses().filter(item => item.status === 'active');
  const requestedClass = classes.find(item => item.id === input.classId);
  const classNameCounts = new Map<string, number>();
  classes.forEach(item => classNameCounts.set(item.name, (classNameCounts.get(item.name) ?? 0) + 1));
  const classCatalog = classes.map((item, index) => ({
    key: `CLASS_${index + 1}`,
    id: item.id,
    name: item.name,
    grade: item.grade,
    ...(classNameCounts.get(item.name)! > 1 ? { term: item.term } : {}),
  }));
  const classIdByCandidateKey = new Map(classCatalog.map(item => [item.key, item.id]));
  const prompt = [
    '你负责把纸质课表 OCR 文本整理成教师可复核的结构化草稿。OCR 是原始候选，可能混入涂改字、污迹字符、重复字或格式噪声；只能依据 OCR 文本和封闭班级目录做最小必要纠错，不得自由补写。',
    'day 使用 1-7 表示周一到周日；period 是课节序号。每个非空课程格生成一项。',
    input.scope === 'teacher'
      ? '这是教师个人课表：title 填课程名称，teacherName 可留空。'
      : `这是班级课表：班级固定为 ${requestedClass?.name ?? '待确认'}，title 填课程名称，teacherName 填任课教师。`,
    [
      '班级文字纠错与目录关联规则：',
      '1. recognizedClassText 必须逐字保留对应课程格中 OCR 给出的班级文字，不得先改写；格内确实没有班级信息才返回空字符串。',
      '2. classCandidateKey 只能选择“当前教师已有班级目录”中真实存在的 key。不得返回班级名称，不得创建目录外班级。',
      '3. OCR 文字包含疑似涂改字、污迹字符、重复字、括号或空格噪声时，可以依据目录做最小必要纠错；classCorrectionType 标记 exact、format-normalized、noise-removed、ocr-corrected 或 uncertain。',
      '4. OCR 中清晰可辨的年级和班号属于关键锚点，不得为了匹配目录而擅自改变。关键锚点不清、多个候选都合理或改动过大时，classCandidateKey 留空，classNeedsReview=true。',
      '5. 相同 recognizedClassText 在整份结果中必须使用相同的 classCandidateKey、classCorrectionType 和 classNeedsReview；返回 JSON 前逐组检查一致性。',
      '6. 目录中的任意名称都可能有效，包括不含年级或数字的名称；不要偏向目录中的第一项或任何特定编号。'
    ].join('\n'),
    'time 尽量使用原图时间；无法确认写“待确认”。confidence 为该项识别置信度。',
    'title、teacherName 只返回可直接显示的纯文本；把 Markdown/LaTeX 装饰符号还原为普通字符，例如“$ ^{\\*} $”应返回“*”。空字段必须返回空字符串，不得填写“待补充”“待确认”等占位词。',
    '只返回 JSON，字段结构：{"items":[{"day":1,"period":1,"title":"课程文字","time":"时间文字或待确认","recognizedClassText":"OCR中的班级原文或空字符串","classCandidateKey":"","classCorrectionType":"uncertain","classNeedsReview":true,"teacherName":"","confidence":0.9}],"warnings":[]}。classCandidateKey 的空字符串仅表示无法可靠选择，能可靠选择时必须填写目录中的真实 key。',
    `当前教师已有班级目录：${JSON.stringify(classCatalog.map(({ key, name, grade, ...optional }) => ({ key, name, grade, ...optional })))}`,
    `OCR 文本：\n${text.slice(0, 30000)}`
  ].join('\n\n');
  const initialResponse = await requestScheduleModel(prompt, config, fetcher);
  const parsed = resultSchema.parse(extractJson(initialResponse.content));
  type ClassGroup = {
    key: string;
    recognizedClassText: string;
    candidateKeys: Set<string>;
    confidence: number;
    needsReview: boolean;
    correctionType: ClassCorrectionType;
  };
  const classGroups = new Map<string, ClassGroup>();
  parsed.items.forEach((item, index) => {
    const key = normalizeClassLabel(item.recognizedClassText) || `UNRECOGNIZED_${index + 1}`;
    const group = classGroups.get(key) ?? {
      key,
      recognizedClassText: item.recognizedClassText,
      candidateKeys: new Set<string>(),
      confidence: 1,
      needsReview: false,
      correctionType: item.classCorrectionType,
    };
    if (item.classCandidateKey) group.candidateKeys.add(item.classCandidateKey);
    group.confidence = Math.min(group.confidence, item.confidence);
    group.needsReview ||= item.classNeedsReview;
    if (group.correctionType !== item.classCorrectionType) group.correctionType = 'uncertain';
    classGroups.set(key, group);
  });
  const matchGroup = (group: ClassGroup) => {
    const candidateKeys = [...group.candidateKeys];
    return matchScheduleClass({
      recognizedClassText: group.recognizedClassText,
      aiCandidateClassId: candidateKeys.length === 1 ? classIdByCandidateKey.get(candidateKeys[0]) : undefined,
      confidence: group.confidence,
      aiNeedsReview: group.needsReview || candidateKeys.length !== 1,
    }, classes);
  };
  const groupMatches = new Map([...classGroups].map(([key, group]) => [key, matchGroup(group)]));
  const unresolvedGroups = [...classGroups.values()].filter(group => groupMatches.get(group.key)?.match.status === 'unresolved');
  const extraWarnings: string[] = initialResponse.retryCount ? [`AI 服务短暂不可用，已自动重试 ${initialResponse.retryCount} 次。`] : [];

  if (input.scope === 'teacher' && unresolvedGroups.length) {
    const retryKeys = new Map(unresolvedGroups.map((group, index) => [`REVIEW_${index + 1}`, group]));
    const retryPrompt = [
      '你只复核发生冲突的 OCR 班级文字，不重新生成课表。OCR 可能混入涂改字、污迹字符、重复字或格式噪声。',
      '对每个输入 key 独立选择封闭目录中的唯一候选。只做最小必要纠错；不得改变清晰可辨的年级或班号；无法可靠选择时保留空 classCandidateKey 并设置 needsReview=true。',
      '不要偏向目录第一项。返回前检查每个候选 key 与目录名称一致。',
      '只返回 JSON，字段结构：{"mappings":[{"key":"输入中的key","classCandidateKey":"","classCorrectionType":"uncertain","confidence":0.9,"needsReview":true}]}。',
      `待复核文字：${JSON.stringify([...retryKeys].map(([key, group]) => ({ key, recognizedClassText: group.recognizedClassText })))}`,
      `班级目录：${JSON.stringify(classCatalog.map(({ key, name, grade, ...optional }) => ({ key, name, grade, ...optional })))}`,
    ].join('\n\n');
    try {
      const retryResponse = await requestScheduleModel(retryPrompt, config, fetcher);
      const retried = mappingRetrySchema.parse(extractJson(retryResponse.content));
      const returned = new Set<string>();
      retried.mappings.forEach(mapping => {
        if (returned.has(mapping.key)) return;
        returned.add(mapping.key);
        const group = retryKeys.get(mapping.key);
        if (!group) return;
        group.candidateKeys = new Set(mapping.classCandidateKey ? [mapping.classCandidateKey] : []);
        group.correctionType = mapping.classCorrectionType;
        group.confidence = mapping.confidence;
        group.needsReview = mapping.needsReview;
        groupMatches.set(group.key, matchGroup(group));
      });
      extraWarnings.push(`已对 ${unresolvedGroups.length} 种冲突班级文字执行一次 AI 复核。`);
      if (retryResponse.retryCount) extraWarnings.push(`班级复核请求自动重试 ${retryResponse.retryCount} 次后恢复。`);
    } catch {
      extraWarnings.push('班级冲突复核服务暂时不可用，请人工确认未解决项。');
    }
  }
  return {
    warnings: [...parsed.warnings, ...extraWarnings],
    items: parsed.items.map((item, index) => {
      const groupKey = normalizeClassLabel(item.recognizedClassText) || `UNRECOGNIZED_${index + 1}`;
      const group = classGroups.get(groupKey)!;
      const classResult = input.scope === 'teacher'
        ? groupMatches.get(groupKey)!
        : {
            classId: requestedClass?.id ?? '',
            className: requestedClass?.name ?? '',
            match: requestedClass
              ? { status: 'matched', reason: 'exact-name', candidateClassIds: [requestedClass.id] } satisfies ScheduleClassMatch
              : { status: 'unresolved', reason: 'no-candidate', candidateClassIds: [] } satisfies ScheduleClassMatch,
          };
      return {
        id: randomUUID(),
        day: item.day,
        period: item.period,
        title: normalizeScheduleCellText(item.title),
        classId: classResult.classId,
        className: classResult.className,
        recognizedClassText: item.recognizedClassText,
        classCorrectionType: group.correctionType,
        classNeedsReview: group.needsReview,
        classMatch: classResult.match,
        type: 'class' as const,
        time: item.time || '待确认',
        scope: input.scope,
        teacherName: normalizeScheduleCellText(item.teacherName),
        confidence: item.confidence
      } satisfies ScheduleItem & { recognizedClassText: string; classCorrectionType: ClassCorrectionType; classNeedsReview: boolean; classMatch: ScheduleClassMatch };
    }).sort((left, right) => left.day - right.day || left.period - right.period)
  };
};

export const importScheduleDocument = async (input: ScheduleImportInput) => {
  const startedAt = performance.now();
  let enhancedAt = startedAt;
  if (input.mimeType.startsWith('image/')) {
    try {
      await enhanceRecognitionPage(input.filePath, { maxDimension: 2400, jpegQuality: 89 });
      enhancedAt = performance.now();
    } catch (error) {
      throw new MaterialParserError('SCHEDULE_IMAGE_ENHANCEMENT_FAILED', { cause: error });
    }
  }
  const parser = new PaddleVisionMaterialParser(getDocumentParserConfig(), { profile: 'schedule' });
  const parsedDocument = await parseScheduleWithRetry(parser, input);
  const document = parsedDocument.document;
  const parsedAt = performance.now();
  const structured = await structureScheduleText(document.markdown || document.blocks.map(block => block.text).join('\n'), input);
  const structuredAt = performance.now();
  return {
    ...structured,
    warnings: [
      ...document.warnings.map(warning => warning.message),
      ...(parsedDocument.retryCount ? [`PaddleOCR 服务繁忙，已自动重试 ${parsedDocument.retryCount} 次。`] : []),
      ...structured.warnings,
    ],
    sourceText: document.markdown.slice(0, 12000),
    timings: {
      enhanceMs: Math.round(enhancedAt - startedAt),
      paddleMs: Math.round(parsedAt - enhancedAt),
      aiMs: Math.round(structuredAt - parsedAt),
      totalMs: Math.round(structuredAt - startedAt)
    }
  };
};
