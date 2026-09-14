/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FirstSectionAnalysis } from '../../../src/domain/types';
import { visionValidationRequestSchema } from '../../schemas/paddleParserArtifact';
import { OpenAICompatibleVisionRegionLocator } from './OpenAICompatibleVisionRegionLocator';

const source = {
  assetKind: 'assignment' as const,
  assetId: 'assignment-1',
  fileName: 'questions.jpg',
  blockIds: ['question-1'],
  quote: '1. 填空题'
};

const analysis: FirstSectionAnalysis = {
  taskId: 'task-1',
  scope: '整份作业',
  status: 'confirmed',
  model: 'test-model',
  materialAssetIds: ['assignment-1', 'answer-1'],
  createdAt: '2026-09-14T00:00:00.000Z',
  questions: [{
    displayNo: '1',
    title: '填空题',
    stem: '1. 填写河水的特点',
    score: 1,
    questionType: '填空题',
    answerRequirement: '',
    standardAnswer: '不能发送给证据提取模型的标准答案',
    explanation: '保密解析',
    rubricPoints: [{ point: '保密采分点', score: 1, description: '' }],
    knowledgeCandidates: [],
    questionSource: source,
    answerSource: null,
    confidence: 0.9,
    reviewReasons: [],
    subquestions: []
  }]
};

test('accepts non-Arabic question labels', () => {
  assert.deepEqual(visionValidationRequestSchema.parse({ assetId: 'submission-1', questionNos: ['Ⅱ', '（一）'] }).questionNos, ['Ⅱ', '（一）']);
});

test('extracts all requested answers in one model call with OCR coordinates but without grading material', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'submission-evidence-'));
  const imagePath = path.join(directory, 'page-1.jpg');
  await writeFile(imagePath, Buffer.from('fake-image'));
  let calls = 0;
  let requestBody = '';
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    requestBody = String(init?.body ?? '');
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items: [{
      displayNo: '1',
      pageNumber: 1,
      boundingBox: { x: 0.1, y: 0.2, width: 0.7, height: 0.2 },
      screenshotAvailable: true,
      answerRefs: [{ order: 0, blockId: 'student-block-1', quote: '清澈', occurrence: 1 }],
      evidenceUnits: [{ evidenceId: '1-answer', kind: 'text', boundingBox: { x: 0.1, y: 0.2, width: 0.7, height: 0.2 }, provisionalText: '清澈', blockIds: ['student-block-1'], confidence: 0.9, needsReview: false, reason: '' }],
      recognizedAnswer: '清澈',
      crossedOutText: [],
      selectedOption: null,
      visualEvidence: '横线上填写清澈',
      existingMarkings: [],
      confidence: 0.9,
      needsReview: false,
      reason: ''
    }] }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const extractor = new OpenAICompatibleVisionRegionLocator({ apiKey: 'test', baseUrl: 'https://example.test/v1', visionModel: 'luna' }, fakeFetch);
    const result = await extractor.locatePages([{ pageNumber: 1, sourceImagePath: imagePath, blocks: [{ blockId: 'student-block-1', order: 0, text: '姓名 张三\n1. 清澈', boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.3 } }] }], ['1'], analysis);

    assert.equal(calls, 1);
    assert.equal(result.items[0]?.recognizedAnswer, '清澈');
    assert.equal(result.items[0]?.answerRefs[0]?.quote, '清澈');
    const parsedRequest = JSON.parse(requestBody) as { messages: Array<{ content: Array<{ type: string; text?: string }> }> };
    const promptText = parsedRequest.messages[0]!.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    assert.match(promptText, /student-block-1/);
    assert.match(promptText, /"x":0\.1/);
    assert.match(promptText, /填写河水的特点/);
    assert.match(promptText, /answerRefs/);
    assert.doesNotMatch(promptText, /不能发送给证据提取模型的标准答案|保密解析|保密采分点/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
