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
    'time 尽量使用原图时间；无法确认写“待确认”。confidence 为该项识别置信度。',
    '只返回 JSON：{"items":[{"day":1,"period":1,"title":"语文","time":"08:00 - 08:45","className":"七年级 5 班","teacherName":"王老师","confidence":0.9}],"warnings":[]}',
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
  const classIdByName = new Map(classes.map(item => [item.name, item.id]));
  return {
    warnings: parsed.warnings,
    items: parsed.items.map(item => ({
      id: randomUUID(),
      day: item.day,
      period: item.period,
      title: item.title,
      classId: input.scope === 'class' ? input.classId : classIdByName.get(item.className) ?? '',
      className: input.scope === 'class' ? requestedClass?.name ?? item.className : item.className,
      type: 'class' as const,
      time: item.time || '待确认',
      scope: input.scope,
      teacherName: item.teacherName,
      confidence: item.confidence
    } satisfies ScheduleItem))
  };
};

export const importScheduleDocument = async (input: ScheduleImportInput) => {
  const parser = new PaddleVisionMaterialParser(getDocumentParserConfig());
  const document = await parser.parse(input);
  const structured = await structureScheduleText(document.markdown || document.blocks.map(block => block.text).join('\n'), input);
  return {
    ...structured,
    warnings: [...document.warnings.map(warning => warning.message), ...structured.warnings],
    sourceText: document.markdown.slice(0, 12000)
  };
};
