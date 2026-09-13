/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentAsset, MissingSubmission, NormalizedDocument, RosterStudent, SubmissionPage } from './types';

const normalizeNameText = (value: string) => value
  .normalize('NFKC')
  .replace(/[\s·•・,，.。:：;；()（）\[\]【】_-]+/g, '')
  .toLowerCase();

const fileNameWithoutExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

const assetText = (asset: DocumentAsset, document?: NormalizedDocument) => [
  fileNameWithoutExtension(asset.fileName),
  ...(document?.blocks.map(block => block.text) ?? [])
].join('\n');

export const buildSubmissionPages = (
  assets: DocumentAsset[],
  documents: NormalizedDocument[],
  students: RosterStudent[]
): SubmissionPage[] => {
  const documentsByAssetId = new Map(documents.map(document => [document.assetId, document]));
  const activeStudents = students.filter(student => student.enrollmentStatus === 'active');

  const pages: SubmissionPage[] = assets.filter(asset => asset.kind === 'student-submission').map((asset, index) => {
    const document = documentsByAssetId.get(asset.id);
    const normalizedText = normalizeNameText(assetText(asset, document));
    const nameCandidates = activeStudents.filter(student => {
      const normalizedName = normalizeNameText(student.name);
      return Boolean(normalizedName && normalizedText.includes(normalizedName));
    });
    const uniqueNames = [...new Set(nameCandidates.map(student => student.name))];
    const matchedStudent = nameCandidates.length === 1 ? nameCandidates[0] : undefined;
    const confidences = document?.blocks.map(block => block.confidence).filter((value): value is number => value !== undefined) ?? [];
    const ocrConfidence = confidences.length
      ? confidences.reduce((total, value) => total + value, 0) / confidences.length
      : 0;
    const ambiguous = nameCandidates.length > 1;

    return {
      id: asset.id,
      sequence: index + 1,
      studentId: matchedStudent?.studentId,
      expectedStudentName: matchedStudent?.name ?? '待确认',
      detectedStudentName: matchedStudent?.name ?? uniqueNames.join(' / '),
      // Persisted-state compatibility only. OCR numbers are never used to match identity.
      detectedStudentNo: matchedStudent?.studentNo ?? '未使用学号识别',
      matchedStudentNo: matchedStudent?.studentNo,
      pageCount: document?.pageCount ?? asset.pageCount ?? 1,
      ocrConfidence,
      studentNoConfidence: undefined,
      textConfidence: ocrConfidence,
      reviewSource: matchedStudent ? 'automatic' : 'teacher',
      issueReason: ambiguous
        ? uniqueNames.length === 1
          ? `班级中有 ${nameCandidates.length} 名同名学生，需要教师确认。`
          : `同一份答卷识别到多个班内姓名：${uniqueNames.join('、')}`
        : matchedStudent
          ? undefined
          : '未识别到班内学生姓名，需要教师确认。',
      rosterMatchStatus: matchedStudent ? 'matched' : ambiguous ? 'ambiguous-student-name' : 'unreadable-student-name',
      status: matchedStudent ? 'matched' : 'needs-review'
    };
  });
  const matchedCounts = pages.reduce((counts, page) => {
    if (page.studentId) counts.set(page.studentId, (counts.get(page.studentId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  return pages.map(page => page.studentId && (matchedCounts.get(page.studentId) ?? 0) > 1
    ? {
        ...page,
        studentId: undefined,
        rosterMatchStatus: 'ambiguous-student-name' as const,
        status: 'needs-review' as const,
        issueReason: `姓名 ${page.expectedStudentName} 在本次答卷中出现多次，需要教师确认。`
      }
    : page);
};

export const buildMissingSubmissions = (pages: SubmissionPage[], students: RosterStudent[]): MissingSubmission[] => {
  const matchedStudentIds = new Set(pages
    .filter(page => page.rosterMatchStatus === 'matched' && page.studentId)
    .map(page => page.studentId));
  return students
    .filter(student => student.enrollmentStatus === 'active' && !matchedStudentIds.has(student.studentId))
    .map(student => ({ studentId: student.studentId, studentName: student.name, studentNo: student.studentNo, status: 'missing' as const }));
};
