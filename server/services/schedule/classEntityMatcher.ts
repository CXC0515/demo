/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SchoolClass } from '../../../src/domain/types';

export type ScheduleClassMatchReason =
  | 'exact-name'
  | 'normalized-name'
  | 'grade-class-number'
  | 'ai-catalog-selection'
  | 'conflicting-evidence'
  | 'ambiguous-candidates'
  | 'no-candidate';

export interface ScheduleClassMatch {
  status: 'matched' | 'unresolved' | 'unassigned';
  reason: ScheduleClassMatchReason | 'teacher-selected' | 'teacher-unassigned';
  candidateClassIds: string[];
}

export interface ScheduleClassEvidence {
  recognizedClassText: string;
  aiClassName?: string;
  aiCandidateClassId?: string;
  confidence?: number;
}

const chineseDigitValues: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

const parseChineseNumber = (value: string) => {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '十') return 10;
  if (value.includes('十')) {
    const [tens, ones = ''] = value.split('十');
    return (tens ? chineseDigitValues[tens] ?? 0 : 1) * 10 + (ones ? chineseDigitValues[ones] ?? 0 : 0);
  }
  return chineseDigitValues[value];
};

export const normalizeClassLabel = (value: string) => value
  .normalize('NFKC')
  .toLocaleLowerCase('zh-CN')
  .replace(/[\s()（）\[\]【】{}<>《》·,，.。:：;；'"“”‘’/_\\\-—–]/g, '')
  .trim();

const gradeNumberFromText = (value: string) => {
  const compact = normalizeClassLabel(value);
  const schoolStage = compact.match(/(?:初中|初)([一二三123])/);
  if (schoolStage) return parseChineseNumber(schoolStage[1]) + 6;
  const highStage = compact.match(/(?:高中|高)([一二三123])/);
  if (highStage) return parseChineseNumber(highStage[1]) + 9;
  const grade = compact.match(/([零〇一二两三四五六七八九十\d]+)年级/);
  return grade ? parseChineseNumber(grade[1]) : undefined;
};

const classNumberFromText = (value: string) => {
  const withoutGrade = normalizeClassLabel(value)
    .replace(/(?:初中|初)[一二三123]/g, '')
    .replace(/(?:高中|高)[一二三123]/g, '')
    .replace(/[零〇一二两三四五六七八九十\d]+年级/g, '');
  const match = withoutGrade.match(/([零〇一二两三四五六七八九十\d]+)班/);
  return match ? parseChineseNumber(match[1]) : undefined;
};

const classIdentity = (value: string, gradeHint = '') => {
  const gradeNumber = gradeNumberFromText(value) ?? gradeNumberFromText(gradeHint);
  const classNumber = classNumberFromText(value);
  return gradeNumber && classNumber ? `${gradeNumber}:${classNumber}` : '';
};

const localCandidates = (evidenceText: string, classes: SchoolClass[]) => {
  const normalizedEvidence = normalizeClassLabel(evidenceText);
  if (!normalizedEvidence) return { ids: [] as string[], reason: undefined as ScheduleClassMatchReason | undefined };

  const exact = classes.filter(item => normalizeClassLabel(item.name) === normalizedEvidence);
  if (exact.length) return { ids: exact.map(item => item.id), reason: 'exact-name' as const };

  const contained = classes.filter(item => {
    const normalizedName = normalizeClassLabel(item.name);
    return normalizedName.length >= 3 && normalizedEvidence.includes(normalizedName);
  });
  if (contained.length) return { ids: contained.map(item => item.id), reason: 'normalized-name' as const };

  const evidenceIdentity = classIdentity(evidenceText);
  if (!evidenceIdentity) return { ids: [] as string[], reason: undefined };
  const identityMatches = classes.filter(item => classIdentity(item.name, item.grade) === evidenceIdentity);
  return { ids: identityMatches.map(item => item.id), reason: identityMatches.length ? 'grade-class-number' as const : undefined };
};

const unique = (values: string[]) => [...new Set(values)];

export const matchScheduleClass = (evidence: ScheduleClassEvidence, classes: SchoolClass[]) => {
  const available = new Map(classes.map(item => [item.id, item]));
  const recognized = localCandidates(evidence.recognizedClassText, classes);
  const named = localCandidates(evidence.aiClassName ?? '', classes);
  const localIds = unique([...recognized.ids, ...named.ids]);
  const aiClass = evidence.aiCandidateClassId ? available.get(evidence.aiCandidateClassId) : undefined;

  if (localIds.length === 1) {
    if (aiClass && aiClass.id !== localIds[0]) {
      return {
        classId: '', className: '',
        match: { status: 'unresolved', reason: 'conflicting-evidence', candidateClassIds: unique([...localIds, aiClass.id]) } satisfies ScheduleClassMatch,
      };
    }
    const matched = available.get(localIds[0])!;
    return {
      classId: matched.id, className: matched.name,
      match: { status: 'matched', reason: recognized.reason ?? named.reason ?? 'normalized-name', candidateClassIds: [matched.id] } satisfies ScheduleClassMatch,
    };
  }

  if (localIds.length > 1) {
    return {
      classId: '', className: '',
      match: { status: 'unresolved', reason: 'ambiguous-candidates', candidateClassIds: localIds } satisfies ScheduleClassMatch,
    };
  }

  if (aiClass && (evidence.confidence ?? 0) >= 0.8) {
    return {
      classId: aiClass.id, className: aiClass.name,
      match: { status: 'matched', reason: 'ai-catalog-selection', candidateClassIds: [aiClass.id] } satisfies ScheduleClassMatch,
    };
  }

  return {
    classId: '', className: '',
    match: { status: 'unresolved', reason: 'no-candidate', candidateClassIds: aiClass ? [aiClass.id] : [] } satisfies ScheduleClassMatch,
  };
};
