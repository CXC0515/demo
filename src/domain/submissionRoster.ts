/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DocumentAsset,
  MissingSubmission,
  NormalizedDocument,
  RosterStudent,
  SubmissionPage,
  SubmissionRosterMatch
} from './types';

const unreadableStudentNos = new Set(['', '-', 'unknown', 'n/a', '无法识别', '未识别', '待识别']);

export const normalizeDetectedStudentNo = (studentNo: string) => studentNo.trim();

export const isReadableStudentNo = (studentNo: string) =>
  !unreadableStudentNos.has(normalizeDetectedStudentNo(studentNo).toLowerCase());

export const getReadableStudentNos = (pages: SubmissionPage[]) =>
  pages
    .filter(page => page.rosterMatchStatus !== 'ambiguous-student-name')
    .map(page => normalizeDetectedStudentNo(page.detectedStudentNo))
    .filter(isReadableStudentNo);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeNameText = (value: string) => value.replace(/\s+/g, '').toLowerCase();

const fileNameWithoutExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

const documentContainsStudentName = (document: NormalizedDocument, name: string) => {
  const normalizedName = normalizeNameText(name);
  return document.blocks.slice(0, 20).some(block => normalizeNameText(block.text).includes(normalizedName));
};

const assetContainsStudentName = (asset: DocumentAsset, document: NormalizedDocument | undefined, name: string) => {
  const normalizedName = normalizeNameText(name);
  return normalizeNameText(fileNameWithoutExtension(asset.fileName)).includes(normalizedName)
    || Boolean(document && documentContainsStudentName(document, name));
};

const documentContainsStudentNo = (document: NormalizedDocument, studentNo: string) => {
  const pattern = new RegExp(`(^|[^0-9A-Za-z])${escapeRegExp(studentNo)}([^0-9A-Za-z]|$)`);
  return document.blocks.slice(0, 20).some(block => {
    const text = block.text.trim();
    if (!text) return false;
    return text === studentNo || (/学号|编号|考号/.test(text) && pattern.test(text));
  });
};

export const buildSubmissionPages = (
  assets: DocumentAsset[],
  documents: NormalizedDocument[],
  students: RosterStudent[]
): SubmissionPage[] => {
  const documentsByAssetId = new Map(documents.map(document => [document.assetId, document]));
  const activeStudents = students.filter(student => student.enrollmentStatus === 'active');
  return assets.filter(asset => asset.kind === 'student-submission').map((asset, index) => {
    const document = documentsByAssetId.get(asset.id);
    const nameCandidates = activeStudents.filter(student => assetContainsStudentName(asset, document, student.name));
    const numberCandidates = document
      ? activeStudents.filter(student => documentContainsStudentNo(document, student.studentNo))
      : [];
    const candidates = nameCandidates.length === 1
      ? nameCandidates
      : nameCandidates.length > 1
        ? nameCandidates.filter(student => numberCandidates.some(candidate => candidate.studentId === student.studentId))
        : numberCandidates;
    const hasAmbiguousName = nameCandidates.length > 1 && candidates.length !== 1;
    const detectedStudentNo = candidates.length === 1
      ? candidates[0].studentNo
      : (hasAmbiguousName ? nameCandidates : candidates).length > 1
        ? (hasAmbiguousName ? nameCandidates : candidates).map(student => student.studentNo).join(' / ')
        : '无法识别';
    const confidences = document?.blocks.map(block => block.confidence).filter((value): value is number => value !== undefined) ?? [];
    const ocrConfidence = confidences.length
      ? confidences.reduce((total, value) => total + value, 0) / confidences.length
      : 0;
    return {
      id: asset.id,
      sequence: index + 1,
      expectedStudentName: candidates.length === 1 ? candidates[0].name : '待确认',
      detectedStudentNo,
      pageCount: document?.pageCount ?? asset.pageCount ?? 1,
      ocrConfidence,
      studentNoConfidence: candidates.length === 1 ? Math.max(ocrConfidence, 0.9) : 0,
      textConfidence: ocrConfidence,
      reviewSource: candidates.length === 1 ? 'automatic' : 'teacher',
      issueReason: hasAmbiguousName
        ? `班级中有 ${nameCandidates.length} 名同名学生，需要通过学号确认。`
        : candidates.length > 1
        ? `同一文件识别到多个班内学号：${detectedStudentNo}`
        : candidates.length === 0
          ? '未识别到班内学生姓名或学号。'
          : undefined,
      rosterMatchStatus: candidates.length === 1 ? 'pending' : hasAmbiguousName ? 'ambiguous-student-name' : 'unreadable-student-no',
      status: candidates.length === 1 ? 'matched' : 'needs-review'
    };
  });
};

export const reconcileSubmissionRoster = (
  pages: SubmissionPage[],
  match: SubmissionRosterMatch
): { pages: SubmissionPage[]; missingSubmissions: MissingSubmission[] } => {
  const matchedByNo = new Map(match.matched.map(student => [student.studentNo, student]));
  const duplicateNos = new Set(match.duplicateStudentNos);
  const unknownNos = new Set(match.unknownStudentNos);

  const reconciledPages = pages.map(page => {
    const studentNo = normalizeDetectedStudentNo(page.detectedStudentNo);
    if (page.rosterMatchStatus === 'ambiguous-student-name') {
      return {
        ...page,
        studentId: undefined,
        rosterIssueReason: page.issueReason ?? '班级中存在同名学生，需要教师确认学号。'
      };
    }
    if (!isReadableStudentNo(studentNo)) {
      return {
        ...page,
        studentId: undefined,
        expectedStudentName: '待确认',
        rosterMatchStatus: 'unreadable-student-no' as const,
        rosterIssueReason: '学号无法识别，需要教师补充。'
      };
    }

    const matchedStudent = matchedByNo.get(studentNo);
    if (duplicateNos.has(studentNo)) {
      return {
        ...page,
        studentId: undefined,
        expectedStudentName: matchedStudent?.name ?? '待确认',
        rosterMatchStatus: 'duplicate-student-no' as const,
        rosterIssueReason: `学号 ${studentNo} 在本次答卷中重复出现。`
      };
    }
    if (unknownNos.has(studentNo) || !matchedStudent) {
      return {
        ...page,
        studentId: undefined,
        expectedStudentName: '名册中无此学生',
        rosterMatchStatus: 'unknown-student-no' as const,
        rosterIssueReason: `学号 ${studentNo} 不在当前班级名册中。`
      };
    }
    return {
      ...page,
      studentId: matchedStudent.studentId,
      expectedStudentName: matchedStudent.name,
      rosterMatchStatus: 'matched' as const,
      rosterIssueReason: undefined
    };
  });

  return {
    pages: reconciledPages,
    missingSubmissions: match.missing.map(student => ({
      studentId: student.studentId,
      studentName: student.name,
      studentNo: student.studentNo,
      status: 'missing'
    }))
  };
};
