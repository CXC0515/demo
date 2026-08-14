/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationSample, GradingDiagnosis, GradingQuestion } from '../../../src/domain/types';

export const buildGradingDiagnosis = (taskId: string, questions: GradingQuestion[], samples: CalibrationSample[]): GradingDiagnosis => {
  const finalSamples = samples.filter(sample => sample.aiScore !== null);
  const students = new Map<string, { studentName: string; score: number }>();
  for (const sample of finalSamples) {
    const score = sample.teacherScore ?? sample.aiScore ?? 0;
    const current = students.get(sample.studentId) ?? { studentName: sample.studentName, score: 0 };
    students.set(sample.studentId, { studentName: current.studentName, score: current.score + score });
  }
  const totalFullScore = questions.reduce((sum, question) => sum + question.score, 0);
  const totals = [...students.entries()].map(([studentId, value]) => ({ studentId, studentName: value.studentName, totalScore: value.score }));
  const averageScore = totals.length ? totals.reduce((sum, item) => sum + item.totalScore, 0) / totals.length : null;
  const questionPerformance = questions.map(question => {
    const items = finalSamples.filter(sample => sample.questionId === question.id);
    const average = items.length ? items.reduce((sum, sample) => sum + (sample.teacherScore ?? sample.aiScore ?? 0), 0) / items.length : 0;
    return { questionId: question.id, displayNo: question.displayNo, averageScore: average, fullScore: question.score, scoreRate: question.score ? average / question.score : 0, reviewCount: items.filter(item => item.needsTeacherReview).length };
  });
  const issueCounts = new Map<string, number>();
  for (const sample of samples) for (const point of sample.missedPoints) issueCounts.set(point, (issueCounts.get(point) ?? 0) + 1);
  const commonIssues = [...issueCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  const sorted = [...totals].sort((a, b) => b.totalScore - a.totalScore);
  const typicalStudents = sorted.length ? [
    { ...sorted[0], role: '优秀示例' as const },
    ...(sorted.length > 1 ? [{ ...sorted[sorted.length - 1], role: '需要关注' as const }] : [])
  ] : [];
  return { taskId, studentCount: totals.length, gradedStudentCount: totals.length, averageScore, averageFullScore: totalFullScore, questionPerformance, commonIssues, typicalStudents };
};
