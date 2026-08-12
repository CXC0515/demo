/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { CalibrationSample, TrialGradingResult } from '../../../src/domain/types';
import { TrialGradingRequest } from '../../schemas/trialGrading';
import { findSubmissionsNeedingTrialGrading, mergeCurrentTrialSamples } from './trialResultReconciler';

const request = (assetIds: string[]): TrialGradingRequest => ({
  questions: [{ questionId: 'q1', displayNo: '1', stem: '', fullScore: 1, standardAnswer: '', rubricPoints: [], teacherRules: [], rubricVersion: 1 }],
  submissions: assetIds.map(assetId => ({ assetId, studentId: assetId, studentName: assetId, studentNo: assetId }))
});
const sample = (assetId: string): CalibrationSample => ({
  id: `q1-${assetId}`, questionId: 'q1', studentId: assetId, studentName: assetId, studentNo: assetId,
  sampleType: 'middle', rawImageDescription: '', rawOcrText: '', ocrText: '', ocrSource: 'paddle',
  ocrConfidence: 1, aiScore: 1, fullScore: 1, gradingConfidence: 1, needsTeacherReview: false,
  matchedPoints: [], missedPoints: [], gradingReason: '', sourceAssetId: assetId, sourceFileName: '',
  sourcePreviewType: 'image', status: 'pending', rubricVersion: 1
});
const result = (assetIds: string[]): TrialGradingResult => ({ taskId: 'task', model: 'model', samples: assetIds.map(sample), createdAt: '' });

test('grades only newly added submissions', () => {
  assert.deepEqual(findSubmissionsNeedingTrialGrading(result(['a', 'b', 'c']), request(['a', 'b', 'c', 'd', 'e'])).map(item => item.assetId), ['d', 'e']);
});

test('retains current samples, adds new samples and removes deleted students', () => {
  const merged = mergeCurrentTrialSamples(result(['a', 'b', 'removed']), request(['a', 'b', 'c']), [sample('c')]);
  assert.deepEqual(merged.map(item => item.sourceAssetId), ['a', 'b', 'c']);
});

test('retains other questions when only one question is regraded', () => {
  const previous = result(['a']);
  previous.samples.push({ ...sample('a'), id: 'q2-a', questionId: 'q2' });
  const merged = mergeCurrentTrialSamples(previous, request(['a']), [sample('a')]);
  assert.deepEqual(merged.map(item => item.questionId).sort(), ['q1', 'q2']);
});
