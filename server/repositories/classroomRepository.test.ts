/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'demo-classroom-sqlite-'));
process.env.ROSTER_DB_PATH = path.join(temporaryDirectory, 'roster.sqlite');

const roster = await import('./rosterRepository');
const classroom = await import('./classroomRepository');
const { closeRosterDatabase } = await import('../database/rosterDatabase');

after(() => {
  closeRosterDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('saves a real classroom layout and enforces class membership', () => {
  const first = roster.createStudent({ studentId: 'seat-student-1', classId: 'c5', studentNo: '5001', name: '座位学生甲' });
  const second = roster.createStudent({ studentId: 'seat-student-2', classId: 'c5', studentNo: '5002', name: '座位学生乙' });
  const otherClass = roster.createClass({
    name: '座位测试二班',
    grade: '七年级',
    term: '2026 秋季学期',
    headTeacher: '测试教师',
    chineseTeacher: '测试教师',
    textbookVersion: '统编版七年级上册',
    defaultSubmitTime: '08:00',
    status: 'active'
  });
  const outsider = roster.createStudent({ studentId: 'seat-outsider', classId: otherClass.id, studentNo: '6001', name: '外班学生' });

  assert.deepEqual(classroom.getClassroomLayout('c5'), {
    classId: 'c5',
    rowCount: 8,
    columnCount: 7,
    seats: []
  });

  const saved = classroom.saveClassroomLayout('c5', {
    rowCount: 5,
    columnCount: 6,
    seats: [
      { seatIndex: 0, studentId: first.studentId },
      { seatIndex: 7, studentId: second.studentId }
    ]
  });
  assert.equal(saved?.rowCount, 5);
  assert.deepEqual(saved?.seats, [
    { seatIndex: 0, studentId: first.studentId },
    { seatIndex: 7, studentId: second.studentId }
  ]);

  assert.throws(() => classroom.saveClassroomLayout('c5', {
    rowCount: 5,
    columnCount: 6,
    seats: [{ seatIndex: 0, studentId: outsider.studentId }]
  }), /CLASSROOM_STUDENT_NOT_IN_CLASS/);
  assert.throws(() => classroom.saveClassroomLayout('c5', {
    rowCount: 5,
    columnCount: 6,
    seats: [
      { seatIndex: 0, studentId: first.studentId },
      { seatIndex: 0, studentId: second.studentId }
    ]
  }), /DUPLICATE_CLASSROOM_SEAT/);
});

test('removes the seat when a student leaves the class', () => {
  const student = roster.findStudentByNo('c5', '5001');
  assert.ok(student);
  roster.updateStudent(student.studentId, {
    ...student,
    classId: roster.listClasses().find(item => item.id !== 'c5')!.id,
    studentNo: '6002'
  });
  assert.equal(classroom.getClassroomLayout('c5')?.seats.some(seat => seat.studentId === student.studentId), false);
});
