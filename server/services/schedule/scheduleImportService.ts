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

const resultSchema = z.object({
  items: z.array(z.object({
    day: z.number().int().min(1).max(7),
    period: z.number().int().min(1).max(12),
    title: z.string().trim().min(1).max(120),
    time: z.string().trim().max(80).default('待确认'),
    className: z.string().trim().max(80).default(''),
    teacherName: z.string().trim().max(80).default(''),
    confidence: z.number().min(0).max(1).default(0.7)
  })).max(200),
  warnings: z.array(z.string().max(300)).max(30).default([])
});

const chineseDigits: Record<string, number> = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
const parseChineseNumber = (value: string) => {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '十') return 10;
  const [tens, ones = ''] = value.split('十');
  if (value.includes('十')) return (tens ? chineseDigits[tens] ?? 0 : 1) * 10 + (ones ? chineseDigits[ones] ?? 0 : 0);
  return chineseDigits[value];
};
const classIdentity = (value: string) => {
  const compact = value.normalize('NFKC').replace(/[\s()（）\-_—]/g, '');
  const juniorMatch = compact.match(/初(?:中)?([一二三123])/);
  const gradeMatch = compact.match(/([零〇一二两三四五六七八九十\d]+)年级/);
  const withoutGrade = compact
    .replace(/初(?:中)?[一二三123]/, '')
    .replace(/[零〇一二两三四五六七八九十\d]+年级/, '');
  const classMatch = withoutGrade.match(/([零〇一二两三四五六七八九十\d]+)班/);
  const juniorGrade = juniorMatch ? parseChineseNumber(juniorMatch[1]) : undefined;
  const grade = juniorGrade ? juniorGrade + 6 : gradeMatch ? parseChineseNumber(gradeMatch[1]) : undefined;
  const classNumber = classMatch ? parseChineseNumber(classMatch[1]) : undefined;
  return grade && classNumber ? `${grade}:${classNumber}` : compact.toLocaleLowerCase();
};

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
  const classes = listClasses();
  const requestedClass = classes.find(item => item.id === input.classId);
  const prompt = [
    '你负责把纸质课表 OCR 文本整理成教师可复核的结构化草稿。不得猜测看不清的内容。',
    'day 使用 1-7 表示周一到周日；period 是课节序号。每个非空课程格生成一项。',
    input.scope === 'teacher'
      ? '这是教师个人课表：title 填课程名称，className 填上课班级，teacherName 可留空。'
      : `这是班级课表：班级固定为 ${requestedClass?.name ?? '待确认'}，title 填课程名称，teacherName 填任课教师。`,
    [
      '班级匹配规则：',
      '1. 将 OCR 中的班级名称与“已知班级”做语义匹配。',
      '2. 匹配时允许年级别称、中文与阿拉伯数字、括号、空格及常见 OCR 误差；“七年级”与“初一”表示同一年级，“十班”“10班”“（10）班”表示同一班级编号。',
      '3. 例如：“七年级十班”可以匹配“初一（10）班”。这只是匹配规则示例，不得把其他结果固定为该班级。',
      '4. 能唯一匹配时，className 必须返回“已知班级”中的完整标准名称，不得保留 OCR 的非标准写法。',
      '5. 有多个合理候选或无法可靠匹配时，不要猜测，className 返回空字符串，并在 warnings 中说明待确认内容。',
      '6. 不得创造“已知班级”列表中不存在的班级。'
    ].join('\n'),
    'time 尽量使用原图时间；无法确认写“待确认”。confidence 为该项识别置信度。',
    '只返回 JSON：{"items":[{"day":1,"period":1,"title":"语文","time":"08:00 - 08:45","className":"<已知班级中唯一匹配的标准名称>","teacherName":"王老师","confidence":0.9}],"warnings":[]}',
    `已知班级：${classes.map(item => item.name).join('、')}`,
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
  const classesByIdentity = new Map<string, typeof classes>();
  classes.forEach(item => {
    const identity = classIdentity(item.name);
    classesByIdentity.set(identity, [...(classesByIdentity.get(identity) ?? []), item]);
  });
  return {
    warnings: parsed.warnings,
    items: parsed.items.map(item => {
      const matches = item.className ? classesByIdentity.get(classIdentity(item.className)) ?? [] : [];
      const matchedClass = matches.length === 1 ? matches[0] : undefined;
      return {
        id: randomUUID(),
        day: item.day,
        period: item.period,
        title: item.title,
        classId: input.scope === 'class' ? input.classId : matchedClass?.id ?? '',
        className: input.scope === 'class' ? requestedClass?.name ?? item.className : matchedClass?.name ?? item.className,
        type: 'class' as const,
        time: item.time || '待确认',
        scope: input.scope,
        teacherName: item.teacherName,
        confidence: item.confidence
      } satisfies ScheduleItem;
    }).sort((left, right) => left.day - right.day || left.period - right.period)
  };
};

export const importScheduleDocument = async (input: ScheduleImportInput) => {
  if (input.mimeType.startsWith('image/')) {
    try {
      await enhanceRecognitionPage(input.filePath);
    } catch (error) {
      throw new MaterialParserError('SCHEDULE_IMAGE_ENHANCEMENT_FAILED', { cause: error });
    }
  }
  const parser = new PaddleVisionMaterialParser(getDocumentParserConfig(), { profile: 'schedule' });
  const document = await parser.parse(input);
  const structured = await structureScheduleText(document.markdown || document.blocks.map(block => block.text).join('\n'), input);
  return {
    ...structured,
    warnings: [...document.warnings.map(warning => warning.message), ...structured.warnings],
    sourceText: document.markdown.slice(0, 12000)
  };
};
