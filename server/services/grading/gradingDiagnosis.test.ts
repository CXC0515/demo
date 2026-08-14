import test from 'node:test';
import assert from 'node:assert/strict';
import { CalibrationSample, GradingQuestion } from '../../../src/domain/types';
import { buildGradingDiagnosis } from './gradingDiagnosis';

const question = (id: string, displayNo: string, score: number): GradingQuestion => ({ id, displayNo, title: '', score, knowledgePoint: '', knowledgeLinks: [], desc: '', parseConfidence: 1, sourceEvidenceIds: [] });
const sample = (studentId: string, studentName: string, questionId: string, score: number, missedPoints: string[] = []): CalibrationSample => ({ id: `${studentId}-${questionId}`, questionId, studentId, studentName, studentNo: studentId, sampleType: 'middle', rawImageDescription: '', ocrText: '', ocrConfidence: 1, aiScore: score, fullScore: 2, gradingConfidence: 1, needsTeacherReview: false, matchedPoints: [], missedPoints, status: 'pending', rubricVersion: 1 });

test('builds diagnosis only from real grading samples', () => {
  const diagnosis = buildGradingDiagnosis('task', [question('q1', '1', 2), question('q2', '2', 2)], [sample('a', '甲', 'q1', 2), sample('a', '甲', 'q2', 2), sample('b', '乙', 'q1', 1, ['采分点甲']), sample('b', '乙', 'q2', 1, ['采分点甲'])]);
  assert.equal(diagnosis.averageScore, 3);
  assert.equal(diagnosis.commonIssues[0].count, 2);
  assert.deepEqual(diagnosis.typicalStudents.map(item => item.studentName), ['甲', '乙']);
});
