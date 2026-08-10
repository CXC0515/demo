/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { z } from 'zod';
import { SchoolClass } from '../../src/domain/types';
import {
  StudentWriteInput,
  createClass,
  createStudent,
  findStudentByNo,
  getRosterSnapshot,
  listClasses,
  listStudents,
  matchSubmissions,
  toggleClassArchive,
  updateClass,
  updateStudent,
  withdrawStudent
} from '../repositories/rosterRepository';

const router = Router();

const classWriteSchema = z.object({
  name: z.string().trim().min(1),
  grade: z.string().trim().min(1),
  term: z.string().trim().min(1),
  headTeacher: z.string().trim().min(1),
  chineseTeacher: z.string().trim().min(1),
  textbookVersion: z.string().trim().min(1),
  defaultSubmitTime: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(['active', 'archived'])
});

const classPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  grade: z.string().trim().min(1).optional(),
  term: z.string().trim().min(1).optional(),
  headTeacher: z.string().trim().min(1).optional(),
  chineseTeacher: z.string().trim().min(1).optional(),
  textbookVersion: z.string().trim().min(1).optional(),
  defaultSubmitTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  representatives: z.array(z.string()).optional(),
  status: z.enum(['active', 'archived']).optional()
});

const studentWriteSchema = z.object({
  studentId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  studentNo: z.string().trim().min(1).max(40),
  classId: z.string().trim().min(1),
  gender: z.enum(['male', 'female']).optional(),
  enrollmentStatus: z.enum(['active', 'transferred', 'withdrawn', 'suspended']).optional()
}).passthrough();

const importSchema = z.object({
  students: z.array(z.object({
    studentId: z.string().trim().min(1).optional(),
    studentNo: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1),
    gender: z.enum(['male', 'female']).optional()
  })).min(1).max(500)
});

const submissionMatchSchema = z.object({
  studentNos: z.array(z.string()).max(1000)
});

const sendRepositoryError = (response: Parameters<Parameters<typeof router.post>[1]>[1], error: unknown) => {
  const code = error instanceof Error ? error.message : 'ROSTER_WRITE_FAILED';
  const status = code === 'CLASS_NOT_FOUND' ? 404 : code.startsWith('DUPLICATE_') ? 409 : 500;
  response.status(status).json({ code });
};

router.get('/roster', (_request, response) => response.json(getRosterSnapshot()));
router.get('/classes', (_request, response) => response.json({ classes: listClasses() }));

router.post('/classes', (request, response) => {
  const parsed = classWriteSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ code: 'INVALID_CLASS', issues: parsed.error.issues });
    return;
  }
  try {
    response.status(201).json({ schoolClass: createClass(parsed.data) });
  } catch (error) {
    sendRepositoryError(response, error);
  }
});

router.patch('/classes/:classId', (request, response) => {
  const parsed = classPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ code: 'INVALID_CLASS', issues: parsed.error.issues });
    return;
  }
  const schoolClass = updateClass(request.params.classId, parsed.data as Partial<SchoolClass>);
  if (!schoolClass) {
    response.status(404).json({ code: 'CLASS_NOT_FOUND' });
    return;
  }
  response.json({ schoolClass });
});

router.post('/classes/:classId/archive', (request, response) => {
  const schoolClass = toggleClassArchive(request.params.classId);
  if (!schoolClass) {
    response.status(404).json({ code: 'CLASS_NOT_FOUND' });
    return;
  }
  response.json({ schoolClass });
});

router.get('/classes/:classId/students', (request, response) => {
  if (!listClasses().some(item => item.id === request.params.classId)) {
    response.status(404).json({ code: 'CLASS_NOT_FOUND' });
    return;
  }
  response.json({ students: listStudents(request.params.classId) });
});

router.get('/classes/:classId/student-by-no/:studentNo', (request, response) => {
  const student = findStudentByNo(request.params.classId, request.params.studentNo.trim());
  if (!student) {
    response.status(404).json({ code: 'STUDENT_NOT_FOUND' });
    return;
  }
  response.json({ student });
});

router.post('/classes/:classId/students/import', (request, response) => {
  const parsed = importSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ code: 'INVALID_IMPORT', issues: parsed.error.issues });
    return;
  }
  if (!listClasses().some(item => item.id === request.params.classId)) {
    response.status(404).json({ code: 'CLASS_NOT_FOUND' });
    return;
  }
  const imported = [];
  const rejected: { row: number; studentNo: string; code: string }[] = [];
  parsed.data.students.forEach((row, index) => {
    try {
      imported.push(createStudent({ ...row, classId: request.params.classId }));
    } catch (error) {
      rejected.push({
        row: index + 1,
        studentNo: row.studentNo,
        code: error instanceof Error ? error.message : 'ROSTER_WRITE_FAILED'
      });
    }
  });
  response.status(imported.length ? 201 : 200).json({ imported, rejected });
});

router.post('/classes/:classId/submission-match', (request, response) => {
  const parsed = submissionMatchSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ code: 'INVALID_STUDENT_NOS', issues: parsed.error.issues });
    return;
  }
  if (!listClasses().some(item => item.id === request.params.classId)) {
    response.status(404).json({ code: 'CLASS_NOT_FOUND' });
    return;
  }
  response.json(matchSubmissions(request.params.classId, parsed.data.studentNos));
});

router.get('/students', (request, response) => {
  const classId = typeof request.query.classId === 'string' ? request.query.classId : undefined;
  response.json({ students: listStudents(classId) });
});

router.post('/students', (request, response) => {
  const parsed = studentWriteSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ code: 'INVALID_STUDENT', issues: parsed.error.issues });
    return;
  }
  try {
    response.status(201).json({ student: createStudent(parsed.data as StudentWriteInput) });
  } catch (error) {
    sendRepositoryError(response, error);
  }
});

router.patch('/students/:studentId', (request, response) => {
  const parsed = studentWriteSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ code: 'INVALID_STUDENT', issues: parsed.error.issues });
    return;
  }
  try {
    const student = updateStudent(request.params.studentId, parsed.data as StudentWriteInput);
    if (!student) {
      response.status(404).json({ code: 'STUDENT_NOT_FOUND' });
      return;
    }
    response.json({ student });
  } catch (error) {
    sendRepositoryError(response, error);
  }
});

router.delete('/students/:studentId', (request, response) => {
  if (!withdrawStudent(request.params.studentId)) {
    response.status(404).json({ code: 'STUDENT_NOT_FOUND' });
    return;
  }
  response.status(204).end();
});

export default router;
