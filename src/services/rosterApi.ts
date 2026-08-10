/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RosterSnapshot, RosterStudent, SchoolClass, Student, SubmissionRosterMatch } from '../domain/types';

export interface RosterImportRow {
  studentId?: string;
  studentNo: string;
  name: string;
  gender?: 'male' | 'female';
}

export interface RosterImportResult {
  imported: RosterStudent[];
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

export const createRosterClass = async (schoolClass: SchoolClass) => {
  const { id: _id, studentCount: _studentCount, representatives: _representatives, ...input } = schoolClass;
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

export const importRosterStudents = (classId: string, students: RosterImportRow[]) =>
  requestJson<RosterImportResult>(
    `/api/classes/${encodeURIComponent(classId)}/students/import`,
    jsonRequest('POST', { students })
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
