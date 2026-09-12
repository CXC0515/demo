/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { firstSectionModelOutputSchema } from '../../schemas/firstSectionAnalysis';
import { StoredMaterial } from '../../repositories/materialRepository';
import { OpenAICompatibleQuestionAnalyzer, sanitizeRecoverableFirstSectionOutput } from './OpenAICompatibleQuestionAnalyzer';

const source = (assetKind: 'assignment' | 'reference-answer', assetId: string, fileName: string, blockId: string) => ({
  assetKind,
  assetId,
  fileName,
  blockIds: [blockId],
  quote: assetKind === 'assignment' ? '第一题' : '答案'
});

const validQuestion = {
  displayNo: '1',
  title: '第一题',
  stem: '第一题',
  score: 5,
  questionType: '简答题',
  answerRequirement: '',
  standardAnswer: '答案',
  explanation: '',
  rubricPoints: [{ point: '采分点', score: 5, description: '' }],
  knowledgeCandidates: [{ nodeId: 'node-1', nodeName: '知识点', confidence: 0.8 }],
  questionSource: source('assignment', 'assignment-1', 'question.txt', 'q-1'),
  answerSource: source('reference-answer', 'answer-1', 'answer.txt', 'a-1'),
  confidence: 0.9,
  reviewReasons: [],
  subquestions: []
};

const modelOutput = { scope: '整份作业', questions: [validQuestion] };

test('keeps valid knowledge candidates unchanged', () => {
  const recovered = sanitizeRecoverableFirstSectionOutput(modelOutput);
  assert.deepEqual(recovered.recoveries, []);
  assert.deepEqual(firstSectionModelOutputSchema.parse(recovered.output), modelOutput);
});

test('drops malformed knowledge candidates without discarding the question', () => {
  const recovered = sanitizeRecoverableFirstSectionOutput({
    ...modelOutput,
    questions: [{
      ...validQuestion,
      knowledgeCandidates: ['知识点', null, validQuestion.knowledgeCandidates[0]!],
      subquestions: [{ ...validQuestion, displayNo: '1.1', knowledgeCandidates: ['子题知识点'], subquestions: undefined }]
    }]
  });
  const parsed = firstSectionModelOutputSchema.parse(recovered.output);
  assert.deepEqual(parsed.questions[0]?.knowledgeCandidates, [validQuestion.knowledgeCandidates[0]]);
  assert.match(parsed.questions[0]?.reviewReasons.join('\n') ?? '', /知识点返回格式异常/);
  assert.deepEqual(parsed.questions[0]?.subquestions[0]?.knowledgeCandidates, []);
  assert.match(parsed.questions[0]?.subquestions[0]?.reviewReasons.join('\n') ?? '', /知识点返回格式异常/);
  assert.deepEqual(recovered.recoveries, [
    { questionNo: '1', droppedKnowledgeCandidateCount: 2 },
    { questionNo: '1.1', droppedKnowledgeCandidateCount: 1 }
  ]);
});

test('still rejects malformed core question fields', () => {
  const recovered = sanitizeRecoverableFirstSectionOutput({
    ...modelOutput,
    questions: [{ ...validQuestion, stem: '', knowledgeCandidates: ['知识点'] }]
  });
  assert.throws(() => firstSectionModelOutputSchema.parse(recovered.output));
});

test('requests strict structured output and gives a non-empty knowledge candidate example', async () => {
  let requestBody: Record<string, unknown> = {};
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(modelOutput) } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof fetch;
  const materials: StoredMaterial[] = [
    {
      id: 'assignment-1', taskId: 'task-1', kind: 'assignment', fileName: 'question.txt', mimeType: 'text/plain', status: 'ready', diskPath: '/tmp/question.txt', publicUrl: '/question.txt',
      normalizedDocument: { assetId: 'assignment-1', sourceFormat: 'text', markdown: '第一题', blocks: [{ id: 'q-1', order: 0, type: 'paragraph', text: '第一题' }], resources: [], warnings: [], parsedAt: '2026-09-12T00:00:00.000Z' }
    },
    {
      id: 'answer-1', taskId: 'task-1', kind: 'reference-answer', fileName: 'answer.txt', mimeType: 'text/plain', status: 'ready', diskPath: '/tmp/answer.txt', publicUrl: '/answer.txt',
      normalizedDocument: { assetId: 'answer-1', sourceFormat: 'text', markdown: '答案', blocks: [{ id: 'a-1', order: 0, type: 'paragraph', text: '答案' }], resources: [], warnings: [], parsedAt: '2026-09-12T00:00:00.000Z' }
    }
  ];
  const analyzer = new OpenAICompatibleQuestionAnalyzer({ apiKey: 'test', baseUrl: 'https://example.test/v1', visionModel: 'test-model' }, fakeFetch);
  const result = await analyzer.analyzeAssignment(materials, [{ id: 'node-1', name: '知识点', type: 'concept', description: '' }]);

  const responseFormat = requestBody.response_format as { type?: string; json_schema?: { strict?: boolean; schema?: unknown } };
  assert.equal(responseFormat.type, 'json_schema');
  assert.equal(responseFormat.json_schema?.strict, true);
  assert.ok(responseFormat.json_schema?.schema);
  assert.match(JSON.stringify(requestBody.messages), /knowledgeCandidates 非空时必须返回对象数组/);
  assert.match(JSON.stringify(requestBody.messages), /禁止返回/);
  assert.equal(result.questions[0]?.stem, '第一题');
});
