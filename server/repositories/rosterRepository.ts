/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { EnrollmentStatus, RosterSnapshot, RosterStudent, SchoolClass, Student } from '../../src/domain/types';
import { getRosterDatabase } from '../database/rosterDatabase';

type StudentDetails = Omit<Student, 'id' | 'name' | 'studentNo' | 'classId' | 'className' | 'gender' | 'isRepresentative' | 'status'>;

interface ClassRow {
  id: string;
  name: string;
  grade: string;
  term: string;
  head_teacher: string;
  chinese_teacher: string;
  textbook_version: string;
  default_submit_time: string;
  status: SchoolClass['status'];
  student_count: number | null;
}

interface StudentRow {
  student_id: string;
  name: string;
  gender: Student['gender'];
  student_status: Student['status'];
  profile_json: string;
  membership_id: string;
  class_id: string;
  class_name: string;
  student_no: string;
  is_representative: number;
  enrollment_status: EnrollmentStatus;
  joined_at: string;
  left_at: string | null;
}

interface MembershipRow {
  id: string;
  class_id: string;
  student_id: string;
  student_no: string;
  is_representative: number;
  status: EnrollmentStatus;
  joined_at: string;
  left_at: string | null;
}

export interface StudentWriteInput {
  studentId?: string;
  name: string;
  studentNo: string;
  classId: string;
  gender?: 'male' | 'female';
  enrollmentStatus?: EnrollmentStatus;
  isRepresentative?: boolean;
  status?: Student['status'];
  behaviorTags?: string[];
  parent?: Student['parent'];
  familyStatus?: Student['familyStatus'];
  familyStatusTag?: string;
  observationHistory?: Student['observationHistory'];
  strongKnowledge?: string[];
  weakKnowledge?: string[];
  recentHomeworkTrend?: number[];
  homeworkHistory?: Student['homeworkHistory'];
  weaknessEvidence?: Student['weaknessEvidence'];
}

const database = getRosterDatabase();

const isVisibleStatus = (status: EnrollmentStatus) => status === 'active' || status === 'suspended';

const getClassRow = (classId: string) => database.prepare('SELECT * FROM classes WHERE id = ?').get(classId) as ClassRow | undefined;

const toClassView = (row: ClassRow): SchoolClass => {
  const representatives = database.prepare(`
    SELECT student_id FROM class_memberships
    WHERE class_id = ? AND status IN ('active', 'suspended') AND is_representative = 1
    ORDER BY joined_at, rowid
  `).all(row.id) as { student_id: string }[];
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    term: row.term,
    headTeacher: row.head_teacher,
    chineseTeacher: row.chinese_teacher,
    textbookVersion: row.textbook_version,
    studentCount: row.student_count ?? 0,
    representatives: representatives.map(item => item.student_id),
    defaultSubmitTime: row.default_submit_time,
    status: row.status
  };
};

const defaultDetails = (): StudentDetails => ({
  behaviorTags: [],
  parent: { name: '', phone: '', relation: '', remark: '' },
  familyStatus: 'normal',
  observationHistory: [],
  strongKnowledge: [],
  weakKnowledge: [],
  recentHomeworkTrend: [],
  homeworkHistory: []
});

const parseDetails = (json: string): StudentDetails => {
  try {
    return { ...defaultDetails(), ...(JSON.parse(json) as Partial<StudentDetails>) };
  } catch {
    return defaultDetails();
  }
};

const toRosterStudent = (row: StudentRow): RosterStudent => ({
  ...parseDetails(row.profile_json),
  id: row.student_id,
  studentId: row.student_id,
  name: row.name,
  gender: row.gender,
  status: row.student_status,
  studentNo: row.student_no,
  classId: row.class_id,
  className: row.class_name,
  isRepresentative: Boolean(row.is_representative),
  enrollmentStatus: row.enrollment_status
});

const studentSelect = `
  SELECT
    s.id AS student_id,
    s.name,
    s.gender,
    s.status AS student_status,
    s.profile_json,
    m.id AS membership_id,
    m.class_id,
    c.name AS class_name,
    m.student_no,
    m.is_representative,
    m.status AS enrollment_status,
    m.joined_at,
    m.left_at
  FROM class_memberships m
  JOIN students s ON s.id = m.student_id
  JOIN classes c ON c.id = m.class_id
`;

const listJoinedStudents = (classId?: string, includeInactive = false) => {
  const conditions: string[] = [];
  const parameters: string[] = [];
  if (classId) {
    conditions.push('m.class_id = ?');
    parameters.push(classId);
  }
  if (!includeInactive) conditions.push("m.status IN ('active', 'suspended')");
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = database.prepare(`${studentSelect} ${where} ORDER BY m.joined_at DESC, m.rowid DESC`).all(...parameters) as StudentRow[];
  return rows.map(toRosterStudent);
};

const createDetails = (input: StudentWriteInput): StudentDetails => ({
  behaviorTags: input.behaviorTags ?? [],
  parent: input.parent ?? { name: '', phone: '', relation: '', remark: '' },
  familyStatus: input.familyStatus ?? 'normal',
  familyStatusTag: input.familyStatusTag,
  observationHistory: input.observationHistory ?? [],
  strongKnowledge: input.strongKnowledge ?? [],
  weakKnowledge: input.weakKnowledge ?? [],
  recentHomeworkTrend: input.recentHomeworkTrend ?? [],
  homeworkHistory: input.homeworkHistory ?? [],
  weaknessEvidence: input.weaknessEvidence
});

const assertClassExists = (classId: string) => {
  if (!getClassRow(classId)) throw new Error('CLASS_NOT_FOUND');
};

const assertUniqueStudentNo = (classId: string, studentNo: string, ignoredMembershipId?: string) => {
  const duplicate = database.prepare(`
    SELECT id FROM class_memberships WHERE class_id = ? AND student_no = ? AND id != COALESCE(?, '')
  `).get(classId, studentNo, ignoredMembershipId ?? null);
  if (duplicate) throw new Error('DUPLICATE_STUDENT_NO');
};

const refreshClassCount = (classId: string) => {
  database.prepare(`
    UPDATE classes
    SET student_count = (
      SELECT COUNT(*) FROM class_memberships WHERE class_id = ? AND status = 'active'
    ), updated_at = ?
    WHERE id = ?
  `).run(classId, new Date().toISOString(), classId);
};

export const getRosterSnapshot = (): RosterSnapshot => ({
  classes: listClasses(),
  students: listJoinedStudents()
});

export const listClasses = () => {
  const rows = database.prepare('SELECT * FROM classes ORDER BY created_at, rowid').all() as ClassRow[];
  return rows.map(toClassView);
};

export const createClass = (input: Omit<SchoolClass, 'id' | 'studentCount' | 'representatives'>) => {
  const schoolClass: SchoolClass = {
    ...input,
    id: randomUUID(),
    name: input.name.trim(),
    term: input.term.trim(),
    studentCount: 0,
    representatives: []
  };
  const now = new Date().toISOString();
  try {
    database.prepare(`
      INSERT INTO classes (
        id, name, grade, term, head_teacher, chinese_teacher, textbook_version,
        default_submit_time, status, student_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      schoolClass.id,
      schoolClass.name,
      schoolClass.grade,
      schoolClass.term,
      schoolClass.headTeacher,
      schoolClass.chineseTeacher,
      schoolClass.textbookVersion,
      schoolClass.defaultSubmitTime,
      schoolClass.status,
      0,
      now,
      now
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) throw new Error('DUPLICATE_CLASS');
    throw error;
  }
  return schoolClass;
};

export const updateClass = (classId: string, patch: Partial<SchoolClass>) => {
  if (!getClassRow(classId)) return null;
  const fieldMap: [keyof SchoolClass, string][] = [
    ['name', 'name'],
    ['grade', 'grade'],
    ['term', 'term'],
    ['headTeacher', 'head_teacher'],
    ['chineseTeacher', 'chinese_teacher'],
    ['textbookVersion', 'textbook_version'],
    ['defaultSubmitTime', 'default_submit_time'],
    ['status', 'status']
  ];

  try {
    database.transaction(() => {
      const updates = fieldMap.filter(([key]) => patch[key] !== undefined);
      if (updates.length) {
        const values = updates.map(([key]) => patch[key] as string);
        database.prepare(`
          UPDATE classes SET ${updates.map(([, column]) => `${column} = ?`).join(', ')}, updated_at = ? WHERE id = ?
        `).run(...values, new Date().toISOString(), classId);
      }
      if (patch.representatives) {
        database.prepare(`
          UPDATE class_memberships SET is_representative = 0
          WHERE class_id = ? AND status IN ('active', 'suspended')
        `).run(classId);
        const markRepresentative = database.prepare(`
          UPDATE class_memberships SET is_representative = 1
          WHERE class_id = ? AND student_id = ? AND status IN ('active', 'suspended')
        `);
        patch.representatives.forEach(studentId => markRepresentative.run(classId, studentId));
      }
    })();
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) throw new Error('DUPLICATE_CLASS');
    throw error;
  }
  return toClassView(getClassRow(classId)!);
};

export const toggleClassArchive = (classId: string) => {
  const row = getClassRow(classId);
  if (!row) return null;
  database.prepare('UPDATE classes SET status = ?, updated_at = ? WHERE id = ?')
    .run(row.status === 'active' ? 'archived' : 'active', new Date().toISOString(), classId);
  return toClassView(getClassRow(classId)!);
};

export const listStudents = (classId?: string) => listJoinedStudents(classId);

export const createStudent = (input: StudentWriteInput) => {
  assertClassExists(input.classId);
  const studentNo = input.studentNo.trim();
  assertUniqueStudentNo(input.classId, studentNo);
  const studentId = input.studentId ?? randomUUID();
  if (database.prepare('SELECT id FROM students WHERE id = ?').get(studentId)) throw new Error('DUPLICATE_STUDENT_ID');
  const membershipId = randomUUID();
  const now = new Date().toISOString();

  database.transaction(() => {
    database.prepare(`
      INSERT INTO students (id, name, gender, status, profile_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      studentId,
      input.name.trim(),
      input.gender ?? 'male',
      input.status ?? 'good',
      JSON.stringify(createDetails(input)),
      now,
      now
    );
    database.prepare(`
      INSERT INTO class_memberships (
        id, class_id, student_id, student_no, is_representative, status, joined_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      membershipId,
      input.classId,
      studentId,
      studentNo,
      input.isRepresentative ? 1 : 0,
      input.enrollmentStatus ?? 'active',
      now
    );
    refreshClassCount(input.classId);
  })();
  return listJoinedStudents(input.classId).find(item => item.studentId === studentId)!;
};

export const updateStudent = (studentId: string, input: StudentWriteInput) => {
  const currentMembership = database.prepare(`
    SELECT * FROM class_memberships
    WHERE student_id = ? AND status IN ('active', 'suspended')
    ORDER BY joined_at DESC, rowid DESC LIMIT 1
  `).get(studentId) as MembershipRow | undefined;
  if (!currentMembership || !database.prepare('SELECT id FROM students WHERE id = ?').get(studentId)) return null;
  assertClassExists(input.classId);
  const studentNo = input.studentNo.trim();
  assertUniqueStudentNo(input.classId, studentNo, currentMembership.class_id === input.classId ? currentMembership.id : undefined);
  const now = new Date().toISOString();

  database.transaction(() => {
    database.prepare(`
      UPDATE students SET name = ?, gender = ?, status = ?, profile_json = ?, updated_at = ? WHERE id = ?
    `).run(
      input.name.trim(),
      input.gender ?? 'male',
      input.status ?? 'good',
      JSON.stringify(createDetails(input)),
      now,
      studentId
    );
    if (currentMembership.class_id === input.classId) {
      database.prepare(`
        UPDATE class_memberships SET student_no = ?, is_representative = ?, status = ?, left_at = ? WHERE id = ?
      `).run(
        studentNo,
        (input.isRepresentative ?? Boolean(currentMembership.is_representative)) ? 1 : 0,
        input.enrollmentStatus ?? currentMembership.status,
        isVisibleStatus(input.enrollmentStatus ?? currentMembership.status) ? null : now,
        currentMembership.id
      );
    } else {
      database.prepare(`
        UPDATE class_memberships SET status = 'transferred', is_representative = 0, left_at = ? WHERE id = ?
      `).run(now, currentMembership.id);
      database.prepare(`
        INSERT INTO class_memberships (
          id, class_id, student_id, student_no, is_representative, status, joined_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?)
      `).run(randomUUID(), input.classId, studentId, studentNo, input.enrollmentStatus ?? 'active', now);
    }
    refreshClassCount(currentMembership.class_id);
    refreshClassCount(input.classId);
  })();
  return listJoinedStudents(input.classId).find(item => item.studentId === studentId) ?? null;
};

export const withdrawStudent = (studentId: string) => {
  const membership = database.prepare(`
    SELECT id, class_id FROM class_memberships
    WHERE student_id = ? AND status IN ('active', 'suspended')
    ORDER BY joined_at DESC, rowid DESC LIMIT 1
  `).get(studentId) as { id: string; class_id: string } | undefined;
  if (!membership) return false;
  database.transaction(() => {
    database.prepare(`
      UPDATE class_memberships SET status = 'withdrawn', is_representative = 0, left_at = ? WHERE id = ?
    `).run(new Date().toISOString(), membership.id);
    refreshClassCount(membership.class_id);
  })();
  return true;
};

export const findStudentByNo = (classId: string, studentNo: string) => {
  const row = database.prepare(`${studentSelect}
    WHERE m.class_id = ? AND m.student_no = ? AND m.status IN ('active', 'suspended')
    ORDER BY m.joined_at DESC, m.rowid DESC LIMIT 1
  `).get(classId, studentNo) as StudentRow | undefined;
  return row ? toRosterStudent(row) : null;
};

export const matchSubmissions = (classId: string, submittedStudentNos: string[]) => {
  const roster = listJoinedStudents(classId).filter(item => item.enrollmentStatus === 'active');
  const counts = new Map<string, number>();
  submittedStudentNos.map(item => item.trim()).filter(Boolean).forEach(studentNo => {
    counts.set(studentNo, (counts.get(studentNo) ?? 0) + 1);
  });
  const rosterByNo = new Map(roster.map(student => [student.studentNo, student]));
  return {
    matched: [...counts.keys()].flatMap(studentNo => rosterByNo.get(studentNo) ?? []),
    missing: roster.filter(student => !counts.has(student.studentNo)),
    unknownStudentNos: [...counts.keys()].filter(studentNo => !rosterByNo.has(studentNo)),
    duplicateStudentNos: [...counts.entries()].filter(([, count]) => count > 1).map(([studentNo]) => studentNo)
  };
};
