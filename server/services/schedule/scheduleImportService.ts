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
import { MaterialParserError } from '../materials/MaterialParser';
import { enhanceRecognitionPage } from '../materials/recognitionImagePreprocessor';
import { extractJson } from '../model/extractJson';
import { matchScheduleClass, ScheduleClassMatch } from './classEntityMatcher';

const resultSchema = z.object({
  items: z.array(z.object({
    day: z.number().int().min(1).max(7),
    period: z.number().int().min(1).max(12),
    title: z.string().trim().min(1).max(120),
    time: z.string().trim().max(80).default('待确认'),
    className: z.string().trim().max(80).default(''),
    recognizedClassText: z.string().trim().max(160).default(''),
    classCandidateKey: z.string().trim().max(20).default(''),
    teacherName: z.string().trim().max(80).default(''),
    confidence: z.number().min(0).max(1).default(0.7)
  })).max(200),
  warnings: z.array(z.string().max(300)).max(30).default([])
});

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
  const classCatalog = classes.map((item, index) => ({
    key: `C${index + 1}`,
    id: item.id,
    name: item.name,
    grade: item.grade,
    term: item.term,
  }));
  const classIdByCandidateKey = new Map(classCatalog.map(item => [item.key, item.id]));
  const prompt = [
    '你负责把纸质课表 OCR 文本整理成教师可复核的结构化草稿。不得猜测看不清的内容。',
    'day 使用 1-7 表示周一到周日；period 是课节序号。每个非空课程格生成一项。',
    input.scope === 'teacher'
      ? '这是教师个人课表：title 填课程名称，className 填上课班级，teacherName 可留空。'
      : `这是班级课表：班级固定为 ${requestedClass?.name ?? '待确认'}，title 填课程名称，teacherName 填任课教师。`,
    [
      '班级匹配规则：',
      '1. 每个课程格都必须把其中与班级有关的原始文字逐字复制到 recognizedClassText；即使无法匹配也不得省略，格内确实没有班级信息才返回空字符串。',
      '2. classCandidateKey 只能从“当前教师已有班级目录”的 key 中选择，不得自行生成 key、班级名或班级。',
      '3. 能唯一确定时填写对应 classCandidateKey，并把 className 填为目录中的完整标准名称；无法确定或多个候选都合理时，两个字段均留空并在 warnings 说明。',
      '4. 匹配时允许年级别称、中文与阿拉伯数字、括号、空格及常见 OCR 误差；“七年级”与“初一”表示同一年级，“十班”“10班”“（10）班”表示同一班级编号。',
      '5. 例如：“七年级十班”可以匹配目录中的“初一（10）班”。这只是匹配规则示例，不得把其他结果固定为该班级。',
      '6. 目录中的任意名称都可能是有效班级名，包括不含年级或数字的名称，必须结合完整名称、年级和学期判断。',
      '7. 不得创造“当前教师已有班级目录”中不存在的班级。'
    ].join('\n'),
    'time 尽量使用原图时间；无法确认写“待确认”。confidence 为该项识别置信度。',
    'title、teacherName 只返回可直接显示的纯文本；把 Markdown/LaTeX 装饰符号还原为普通字符，例如“$ ^{\\*} $”应返回“*”。空字段必须返回空字符串，不得填写“待补充”“待确认”等占位词。',
    '只返回 JSON：{"items":[{"day":1,"period":1,"title":"语文","time":"08:00 - 08:45","recognizedClassText":"课表格内与班级有关的原始文字","classCandidateKey":"C1或空字符串","className":"目录中的完整标准名称或空字符串","teacherName":"王老师","confidence":0.9}],"warnings":[]}',
    `当前教师已有班级目录：${JSON.stringify(classCatalog.map(({ key, name, grade, term }) => ({ key, name, grade, term })))}`,
    `OCR 文本：\n${text.slice(0, 30000)}`
  ].join('\n\n');
  const response = await fetcher(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.visionModel,
      messages: [{ role: 'system', content: '只返回 JSON，不输出解释。' }, { role: 'user', content: prompt }],
      reasoning_effort: 'low'
    }),
    signal: AbortSignal.timeout(300_000)
  });
  if (!response.ok) throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
  const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('MODEL_EMPTY_RESPONSE');
  const parsed = resultSchema.parse(extractJson(content));
  return {
    warnings: parsed.warnings,
    items: parsed.items.map(item => {
      const classResult = input.scope === 'teacher'
        ? matchScheduleClass({
            recognizedClassText: item.recognizedClassText,
            aiClassName: item.className,
            aiCandidateClassId: classIdByCandidateKey.get(item.classCandidateKey),
            confidence: item.confidence,
          }, classes)
        : {
            classId: requestedClass?.id ?? '',
            className: requestedClass?.name ?? item.className,
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
        recognizedClassText: item.recognizedClassText || item.className,
        classMatch: classResult.match,
        type: 'class' as const,
        time: item.time || '待确认',
        scope: input.scope,
        teacherName: normalizeScheduleCellText(item.teacherName),
        confidence: item.confidence
      } satisfies ScheduleItem & { recognizedClassText: string; classMatch: ScheduleClassMatch };
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
  const document = await parser.parse(input);
  const parsedAt = performance.now();
  const structured = await structureScheduleText(document.markdown || document.blocks.map(block => block.text).join('\n'), input);
  const structuredAt = performance.now();
  return {
    ...structured,
    warnings: [...document.warnings.map(warning => warning.message), ...structured.warnings],
    sourceText: document.markdown.slice(0, 12000),
    timings: {
      enhanceMs: Math.round(enhancedAt - startedAt),
      paddleMs: Math.round(parsedAt - enhancedAt),
      aiMs: Math.round(structuredAt - parsedAt),
      totalMs: Math.round(structuredAt - startedAt)
    }
  };
};
