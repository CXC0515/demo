import { Student } from './types';

export type StudentSortKey = 'name' | 'studentNo' | 'className' | 'gender' | 'enrollmentStatus' | 'status' | 'familyStatus' | 'recentScore';
export type SortDirection = 'asc' | 'desc';

const pinyin = new Intl.Collator('zh-CN-u-co-pinyin', { sensitivity: 'base' });
const natural = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
const statusRank: Record<Student['status'], number> = { outstanding: 0, good: 1, warning: 2, risk: 3 };
const enrollmentRank: Record<string, number> = { active: 0, suspended: 1, transferred: 2, withdrawn: 3 };
const familyRank: Record<Student['familyStatus'], number> = { normal: 0, attention: 1, special: 2 };

const compareValue = (left: Student, right: Student, key: StudentSortKey) => {
  if (key === 'studentNo') return natural.compare(left.studentNo, right.studentNo);
  if (key === 'name') return pinyin.compare(left.name, right.name);
  if (key === 'className') return pinyin.compare(left.className, right.className);
  if (key === 'gender') return left.gender.localeCompare(right.gender);
  if (key === 'status') return statusRank[left.status] - statusRank[right.status];
  if (key === 'enrollmentStatus') {
    const leftEnrollment = (left as Student & { enrollmentStatus?: string }).enrollmentStatus ?? 'active';
    const rightEnrollment = (right as Student & { enrollmentStatus?: string }).enrollmentStatus ?? 'active';
    return enrollmentRank[leftEnrollment] - enrollmentRank[rightEnrollment];
  }
  if (key === 'familyStatus') return familyRank[left.familyStatus] - familyRank[right.familyStatus];
  return (left.recentHomeworkTrend.at(-1) ?? -1) - (right.recentHomeworkTrend.at(-1) ?? -1);
};

export const sortStudents = <T extends Student>(students: T[], key: StudentSortKey, direction: SortDirection) =>
  [...students].sort((left, right) => {
    const result = compareValue(left, right, key) || natural.compare(left.studentNo, right.studentNo);
    return direction === 'asc' ? result : -result;
  });
