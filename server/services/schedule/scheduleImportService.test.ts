/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'demo-schedule-import-'));
process.env.ROSTER_DB_PATH = path.join(directory, 'roster.sqlite');
const { structureScheduleText } = await import('./scheduleImportService');
const { closeRosterDatabase } = await import('../../database/rosterDatabase');
const { updateClass } = await import('../../repositories/rosterRepository');
after(() => { closeRosterDatabase(); rmSync(directory, { recursive: true, force: true }); });

test('turns AI timetable JSON into an editable teacher draft', async () => {
  updateClass('c5', { name: '初一（10）班', grade: '七年级' });
  let requestBody = '';
  const fakeFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = String(init?.body ?? '');
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    items: [
      { day: 2, period: 1, title: '阅读', time: '08:00 - 08:45', className: '初一10班', teacherName: '', confidence: 0.88 },
      { day: 1, period: 2, title: '语文', time: '08:55 - 09:40', className: '七年级十班', teacherName: '', confidence: 0.91 }
    ],
    warnings: ['第三节模糊']
  }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const result = await structureScheduleText('周一 第二节 语文 七年级十班', { scope: 'teacher', classId: 'c5' }, {
    apiKey: 'test', baseUrl: 'https://example.test/v1', visionModel: 'test-model'
  }, fakeFetch as typeof fetch);
  assert.equal(result.items[0].scope, 'teacher');
  assert.deepEqual(result.items.map(item => item.classId), ['c5', 'c5']);
  assert.deepEqual(result.items.map(item => item.className), ['初一（10）班', '初一（10）班']);
  assert.equal(result.items[0].confidence, 0.91);
  assert.deepEqual(result.items.map(item => [item.day, item.period]), [[1, 2], [2, 1]]);
  assert.deepEqual(result.warnings, ['第三节模糊']);
  assert.match(requestBody, /这只是匹配规则示例/);
  assert.match(requestBody, /className 必须返回/);
});
