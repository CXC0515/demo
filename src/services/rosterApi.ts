/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommitteeAssignment, CommitteeRole, RosterSnapshot, RosterStudent, SchoolClass, Student, SubmissionRosterMatch } from '../domain/types';

export type RosterImportField = 'studentNo' | 'name' | 'gender' | 'parentName' | 'parentPhone' | 'parentRelation' | 'parentRemark';
export type RosterImportMapping = Record<number, RosterImportField | null>;
export interface RosterImportGrid { headers: string[]; rows: string[][]; mapping?: RosterImportMapping; }
export interface RosterImportPreviewRow {
  row: number;
  action: 'create' | 'update' | 'conflict' | 'invalid';
  studentNo: string;
  name: string;
  targetStudentId?: string;
  changes: string[];
  message?: string;
  values: Partial<Record<RosterImportField, string>>;
}
export interface RosterImportPreview { mapping: RosterImportMapping; rows: RosterImportPreviewRow[]; }

export interface RosterImportResult {
  created: RosterStudent[];
  updated: RosterStudent[];
  rejected: { row: number; studentNo: string; code: string }[];
}

const readErrorCode = async (response: Response) => {
  const body = await response.json().catch(() => ({})) as { code?: string };
  return body.code ?? `HTTP_${response.status}`;
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await readErrorCode(response));
  return response.json() as Promise<T>;
};

const jsonRequest = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});

export const getRoster = () => requestJson<RosterSnapshot>('/api/roster');

export const listRosterClasses = async () => {
  const body = await requestJson<{ classes: SchoolClass[] }>('/api/classes');
  return body.classes;
};

export const listRosterStudents = async (classId: string) => {
  const body = await requestJson<{ students: RosterStudent[] }>(
    `/api/classes/${encodeURIComponent(classId)}/students`
  );
  return body.students;
};

export const createRosterClass = async (schoolClass: SchoolClass) => {
  const { id: _id, studentCount: _studentCount, ...input } = schoolClass;
  const body = await requestJson<{ schoolClass: SchoolClass }>('/api/classes', jsonRequest('POST', input));
  return body.schoolClass;
};

export const updateRosterClass = async (schoolClass: SchoolClass) => {
  const body = await requestJson<{ schoolClass: SchoolClass }>(
    `/api/classes/${encodeURIComponent(schoolClass.id)}`,
    jsonRequest('PATCH', schoolClass)
  );
  return body.schoolClass;
};

export const toggleRosterClassArchive = async (classId: string) => {
  const body = await requestJson<{ schoolClass: SchoolClass }>(
    `/api/classes/${encodeURIComponent(classId)}/archive`,
    jsonRequest('POST')
  );
  return body.schoolClass;
};

export const createRosterCommitteeRole = async (name: string) => {
  const body = await requestJson<{ role: CommitteeRole }>('/api/committee-roles', jsonRequest('POST', { name }));
  return body.role;
};

export const updateRosterCommitteeRole = async (roleId: string, name: string) => {
  const body = await requestJson<{ role: CommitteeRole }>(
    `/api/committee-roles/${encodeURIComponent(roleId)}`,
    jsonRequest('PATCH', { name })
  );
  return body.role;
};

export const deleteRosterCommitteeRole = async (roleId: string) => {
  const response = await fetch(`/api/committee-roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await readErrorCode(response));
};

export const saveClassCommitteeAssignments = async (
  classId: string,
  assignments: Omit<CommitteeAssignment, 'classId'>[]
) => {
  const body = await requestJson<{ students: RosterStudent[] }>(
    `/api/classes/${encodeURIComponent(classId)}/committee-assignments`,
    jsonRequest('PUT', { assignments })
  );
  return body.students;
};

export const createRosterStudent = async (student: Student) => {
  const body = await requestJson<{ student: RosterStudent }>('/api/students', jsonRequest('POST', student));
  return body.student;
};

export const updateRosterStudent = async (student: Student) => {
  const body = await requestJson<{ student: RosterStudent }>(
    `/api/students/${encodeURIComponent(student.id)}`,
    jsonRequest('PATCH', student)
  );
  return body.student;
};

export const deleteRosterStudent = async (studentId: string) => {
  const response = await fetch(`/api/students/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await readErrorCode(response));
};

export const previewRosterStudentsImport = (classId: string, grid: RosterImportGrid) =>
  requestJson<RosterImportPreview>(
    `/api/classes/${encodeURIComponent(classId)}/students/import/preview`,
    jsonRequest('POST', grid)
  );

export const importRosterStudents = (classId: string, grid: RosterImportGrid) =>
  requestJson<RosterImportResult>(
    `/api/classes/${encodeURIComponent(classId)}/students/import`,
    jsonRequest('POST', grid)
  );

export const findRosterStudentByNo = async (classId: string, studentNo: string) => {
  const body = await requestJson<{ student: RosterStudent }>(
    `/api/classes/${encodeURIComponent(classId)}/student-by-no/${encodeURIComponent(studentNo)}`
  );
  return body.student;
};

export const matchRosterSubmissions = (classId: string, studentNos: string[]) =>
  requestJson<SubmissionRosterMatch>(
    `/api/classes/${encodeURIComponent(classId)}/submission-match`,
    jsonRequest('POST', { studentNos })
  );
