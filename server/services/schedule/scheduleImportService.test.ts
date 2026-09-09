/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { MaterialParserError } from '../materials/MaterialParser';

const directory = mkdtempSync(path.join(tmpdir(), 'demo-schedule-import-'));
process.env.ROSTER_DB_PATH = path.join(directory, 'roster.sqlite');
const { normalizeScheduleCellText, parseScheduleWithRetry, requestScheduleModel, structureScheduleText } = await import('./scheduleImportService');
const { closeRosterDatabase } = await import('../../database/rosterDatabase');
const { createClass } = await import('../../repositories/rosterRepository');
after(() => { closeRosterDatabase(); rmSync(directory, { recursive: true, force: true }); });

const class10 = createClass({ name: '初一（10）班', grade: '七年级', term: '2026 秋季学期', headTeacher: '测试教师', status: 'active' });
createClass({ name: '初一（9）班', grade: '七年级', term: '2026 秋季学期', headTeacher: '测试教师', status: 'active' });
const completion = (content: unknown, status = 200) => new Response(
  status === 200 ? JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }) : '',
  { status, headers: { 'Content-Type': 'application/json' } },
);
const modelConfig = { apiKey: 'test', baseUrl: 'https://example.test/v1', visionModel: 'test-model' };

test('uses one consistent closed-catalog mapping for repeated OCR class text', async () => {
  let requestBody = '';
  let calls = 0;
  const fakeFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    requestBody = String(init?.body ?? '');
    return completion({
      items: [
        { day: 2, period: 1, title: '阅读', time: '08:00 - 08:45', recognizedClassText: '初一10班', classCandidateKey: 'CLASS_1', classCorrectionType: 'format-normalized', classNeedsReview: false, teacherName: '', confidence: 0.88 },
        { day: 1, period: 2, title: '语文', time: '08:55 - 09:40', recognizedClassText: '初一10班', classCandidateKey: 'CLASS_1', classCorrectionType: 'format-normalized', classNeedsReview: false, teacherName: '', confidence: 0.91 }
      ], warnings: []
    });
  };
  const result = await structureScheduleText('周一 第二节 语文 初一10班', { scope: 'teacher', classId: class10.id }, modelConfig, fakeFetch as typeof fetch);
  assert.equal(calls, 1);
  assert.deepEqual(result.items.map(item => item.classId), [class10.id, class10.id]);
  assert.deepEqual(result.items.map(item => item.classCorrectionType), ['format-normalized', 'format-normalized']);
  assert.deepEqual(result.items.map(item => item.classMatch.status), ['matched', 'matched']);
  assert.match(requestBody, /最小必要纠错/);
  assert.match(requestBody, /相同 recognizedClassText/);
  assert.doesNotMatch(requestBody, /七年级十班/);
  assert.doesNotMatch(requestBody, /C1或空字符串/);
  assert.doesNotMatch(requestBody, /className/);
  assert.doesNotMatch(requestBody, /2026 秋季学期/);
});

test('rechecks one conflicting OCR spelling and applies the corrected mapping to every occurrence', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    if (calls === 1) return completion({
      items: [
        { day: 1, period: 1, title: '语文', time: '待确认', recognizedClassText: '初秃一（10）班', classCandidateKey: 'CLASS_2', classCorrectionType: 'ocr-corrected', classNeedsReview: false, teacherName: '', confidence: 0.95 },
        { day: 2, period: 2, title: '语文', time: '待确认', recognizedClassText: '初秃一（10）班', classCandidateKey: 'CLASS_1', classCorrectionType: 'noise-removed', classNeedsReview: false, teacherName: '', confidence: 0.96 },
      ], warnings: []
    });
    return completion({ mappings: [{ key: 'REVIEW_1', classCandidateKey: 'CLASS_1', classCorrectionType: 'noise-removed', confidence: 0.98, needsReview: false }] });
  };
  const result = await structureScheduleText('初秃一（10）班', { scope: 'teacher', classId: '' }, modelConfig, fakeFetch as typeof fetch);
  assert.equal(calls, 2);
  assert.deepEqual(result.items.map(item => item.classId), [class10.id, class10.id]);
  assert.deepEqual(result.items.map(item => item.classCorrectionType), ['noise-removed', 'noise-removed']);
  assert.match(result.warnings.join('\n'), /执行一次 AI 复核/);
});

test('rechecks an AI candidate that points an exact OCR class name at the wrong class', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    if (calls === 1) return completion({
      items: [{ day: 1, period: 1, title: '语文', time: '待确认', recognizedClassText: '初一（9）班', classCandidateKey: 'CLASS_1', classCorrectionType: 'exact', classNeedsReview: false, teacherName: '', confidence: 0.99 }], warnings: []
    });
    return completion({ mappings: [{ key: 'REVIEW_1', classCandidateKey: 'CLASS_2', classCorrectionType: 'exact', confidence: 0.99, needsReview: false }] });
  };
  const result = await structureScheduleText('初一（9）班', { scope: 'teacher', classId: '' }, modelConfig, fakeFetch as typeof fetch);
  assert.equal(result.items[0].className, '初一（9）班');
  assert.equal(result.items[0].classMatch.status, 'matched');
  assert.equal(calls, 2);
});

test('keeps an unsafe class-number correction unresolved after focused review', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    if (calls === 1) return completion({
      items: [{ day: 1, period: 1, title: '语文', time: '待确认', recognizedClassText: '初秃一（10）班', classCandidateKey: 'CLASS_2', classCorrectionType: 'ocr-corrected', classNeedsReview: false, teacherName: '', confidence: 0.99 }], warnings: []
    });
    return completion({ mappings: [{ key: 'REVIEW_1', classCandidateKey: 'CLASS_2', classCorrectionType: 'ocr-corrected', confidence: 0.99, needsReview: false }] });
  };
  const result = await structureScheduleText('初秃一（10）班', { scope: 'teacher', classId: '' }, modelConfig, fakeFetch as typeof fetch);
  assert.equal(result.items[0].classId, '');
  assert.equal(result.items[0].classMatch.status, 'unresolved');
  assert.equal(calls, 2);
});

test('retries transient model failures without retrying successful responses', async () => {
  let calls = 0;
  const result = await requestScheduleModel('test', modelConfig, (async () => {
    calls += 1;
    return calls === 1 ? completion({}, 503) : completion({ ok: true });
  }) as typeof fetch, async () => undefined);
  assert.equal(calls, 2);
  assert.equal(result.retryCount, 1);
});

test('retries a full PaddleOCR queue and preserves the successful document', async () => {
  let calls = 0;
  const document = { markdown: '课表' };
  const parser = { parse: async () => {
    calls += 1;
    if (calls === 1) throw new MaterialParserError('PADDLEOCR_INVALID_REQUEST', { cause: new Error('任务提交队列已满，请稍后重试') });
    return document;
  } };
  const result = await parseScheduleWithRetry(parser as never, { assetId: 'asset', fileName: 'a.jpg', mimeType: 'image/jpeg', filePath: '/tmp/a.jpg' }, async () => undefined);
  assert.equal(calls, 2);
  assert.equal(result.retryCount, 1);
  assert.equal(result.document, document);
});

test('normalizes OCR decoration markers without stripping real formulas', () => {
  assert.equal(normalizeScheduleCellText('体综 $ ^{\\*} $'), '体综 *');
  assert.equal(normalizeScheduleCellText('体综 $\\ast$'), '体综 *');
  assert.equal(normalizeScheduleCellText('数学 $x^2$'), '数学 $x^2$');
});
