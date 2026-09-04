/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ClassMembership, SchoolClass, Student } from '../../src/domain/types';
import { closeRosterDatabase, getRosterDatabase } from '../database/rosterDatabase';

type LegacyStudentProfile = Omit<Student, 'id' | 'studentNo' | 'classId' | 'className' | 'committeeRoleIds'> & {
  studentId: string;
  isRepresentative?: boolean;
};

type LegacySchoolClass = SchoolClass & {
  textbookVersion?: string;
  defaultSubmitTime?: string;
  representatives?: string[];
};

type LegacyClassMembership = ClassMembership & { isRepresentative?: boolean };

interface LegacyRosterStore {
  classes: LegacySchoolClass[];
  students: LegacyStudentProfile[];
  memberships: LegacyClassMembership[];
}

const sourcePath = path.resolve(process.argv[2] ?? 'var/data/roster.json');
if (!existsSync(sourcePath)) throw new Error(`Roster JSON not found: ${sourcePath}`);

const store = JSON.parse(readFileSync(sourcePath, 'utf8')) as LegacyRosterStore;
if (!Array.isArray(store.classes) || !Array.isArray(store.students) || !Array.isArray(store.memberships)) {
  throw new Error('Roster JSON must contain classes, students, and memberships arrays.');
}

const database = getRosterDatabase();
const existingStudents = database.prepare('SELECT COUNT(*) AS count FROM students').get() as { count: number };
const existingMemberships = database.prepare('SELECT COUNT(*) AS count FROM class_memberships').get() as { count: number };
const unrelatedClasses = database.prepare("SELECT COUNT(*) AS count FROM classes WHERE id != 'c5'").get() as { count: number };
if (existingStudents.count || existingMemberships.count || unrelatedClasses.count) {
  throw new Error('JSON migration requires a fresh roster database. Existing authoritative data was not changed.');
}

const now = new Date().toISOString();
const insertClass = database.prepare(`
  INSERT INTO classes (
    id, name, grade, term, head_teacher, chinese_teacher, textbook_version,
    default_submit_time, status, student_count, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    grade = excluded.grade,
    term = excluded.term,
    head_teacher = excluded.head_teacher,
    chinese_teacher = excluded.chinese_teacher,
    textbook_version = excluded.textbook_version,
    default_submit_time = excluded.default_submit_time,
    status = excluded.status,
    student_count = excluded.student_count,
    updated_at = excluded.updated_at
`);
const insertStudent = database.prepare(`
  INSERT INTO students (id, name, gender, status, profile_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertMembership = database.prepare(`
  INSERT INTO class_memberships (
    id, class_id, student_id, student_no, status, joined_at, left_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

database.transaction(() => {
  store.classes.forEach(schoolClass => {
    insertClass.run(
      schoolClass.id,
      schoolClass.name,
      schoolClass.grade,
      schoolClass.term,
      schoolClass.headTeacher,
      schoolClass.chineseTeacher,
      schoolClass.textbookVersion ?? '',
      schoolClass.defaultSubmitTime ?? '08:00',
      schoolClass.status,
      schoolClass.studentCount,
      now,
      now
    );
  });
  store.students.forEach(profile => {
    const { studentId, name, gender, status, isRepresentative: _discardedLegacyRole, ...details } = profile;
    insertStudent.run(studentId, name, gender ?? 'male', status ?? 'good', JSON.stringify(details), now, now);
  });
  store.memberships.forEach(membership => {
    insertMembership.run(
      membership.id,
      membership.classId,
      membership.studentId,
      membership.studentNo,
      membership.status,
      membership.joinedAt,
      membership.leftAt ?? null
    );
  });
})();

closeRosterDatabase();
console.log(`Migrated ${store.classes.length} classes, ${store.students.length} students, and ${store.memberships.length} memberships.`);
