/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const classroomStudentNoKey = (userId: string) => `classroom-export-student-no:${userId}`;

export const readClassroomExportStudentNo = (userId: string) => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(classroomStudentNoKey(userId)) !== 'false';
};

export const writeClassroomExportStudentNo = (userId: string, includeStudentNo: boolean) => {
  localStorage.setItem(classroomStudentNoKey(userId), String(includeStudentNo));
};
