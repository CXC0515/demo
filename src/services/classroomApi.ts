/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClassroomLayout } from '../domain/types';

const readErrorCode = async (response: Response) => {
  const body = await response.json().catch(() => ({})) as { code?: string };
  return body.code ?? `HTTP_${response.status}`;
};

export const getClassroomLayout = async (classId: string) => {
  const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/classroom-layout`);
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { layout: ClassroomLayout };
  return body.layout;
};

export const saveClassroomLayout = async (layout: ClassroomLayout) => {
  const response = await fetch(`/api/classes/${encodeURIComponent(layout.classId)}/classroom-layout`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rowCount: layout.rowCount, columnCount: layout.columnCount, seats: layout.seats })
  });
  if (!response.ok) throw new Error(await readErrorCode(response));
  const body = await response.json() as { layout: ClassroomLayout };
  return body.layout;
};
