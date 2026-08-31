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
after(() => { closeRosterDatabase(); rmSync(directory, { recursive: true, force: true }); });

test('turns AI timetable JSON into an editable teacher draft', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    items: [{ day: 1, period: 2, title: '语文', time: '08:55 - 09:40', className: '七年级 5 班', teacherName: '', confidence: 0.91 }],
    warnings: ['第三节模糊']
  }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const result = await structureScheduleText('周一 第二节 语文 七年级5班', { scope: 'teacher', classId: 'c5' }, {
    apiKey: 'test', baseUrl: 'https://example.test/v1', visionModel: 'test-model'
  }, fakeFetch as typeof fetch);
  assert.equal(result.items[0].scope, 'teacher');
  assert.equal(result.items[0].classId, 'c5');
  assert.equal(result.items[0].confidence, 0.91);
  assert.deepEqual(result.warnings, ['第三节模糊']);
});
