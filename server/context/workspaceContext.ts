/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { runtimeConfig } from '../config/runtimeConfig';

export type WorkspaceRole = 'owner' | 'teacher';

export interface WorkspaceContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  root: string;
  dataDirectory: string;
  uploadDirectory: string;
}

const storage = new AsyncLocalStorage<WorkspaceContext>();
const safeId = /^[a-zA-Z0-9_-]{8,128}$/;

export const workspacePaths = (workspaceId: string) => {
  if (!safeId.test(workspaceId)) throw new Error('INVALID_WORKSPACE_ID');
  const root = path.join(runtimeConfig.workspacesDirectory, workspaceId);
  return { root, dataDirectory: path.join(root, 'data'), uploadDirectory: path.join(root, 'uploads') };
};

export const createWorkspaceContext = (
  userId: string,
  workspaceId: string,
  role: WorkspaceRole,
): WorkspaceContext => ({ userId, workspaceId, role, ...workspacePaths(workspaceId) });

export const runWithWorkspace = <T>(context: WorkspaceContext, callback: () => T): T => storage.run(context, callback);
export const getWorkspaceContext = () => {
  const context = storage.getStore();
  if (!context) throw new Error('WORKSPACE_CONTEXT_REQUIRED');
  return context;
};
export const getOptionalWorkspaceContext = () => storage.getStore();

// Repository unit tests and one-off legacy migration scripts do not execute in an
// HTTP request. Their fallback is deliberately outside the authenticated server path.
export const getWorkspaceStorage = () => storage.getStore() ?? {
  root: runtimeConfig.dataRoot,
  dataDirectory: runtimeConfig.dataDirectory,
  uploadDirectory: runtimeConfig.uploadDirectory,
};

export const dataFilePath = (...segments: string[]) => path.join(getWorkspaceStorage().dataDirectory, ...segments);
export const uploadFilePath = (...segments: string[]) => path.join(getWorkspaceStorage().uploadDirectory, ...segments);

export const assertPathInsideWorkspace = (target: string, kind: 'data' | 'uploads' = 'uploads') => {
  const base = path.resolve(kind === 'data' ? getWorkspaceStorage().dataDirectory : getWorkspaceStorage().uploadDirectory);
  const resolved = path.resolve(target);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) throw new Error('PATH_OUTSIDE_WORKSPACE');
  return resolved;
};
