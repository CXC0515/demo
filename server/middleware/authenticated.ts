/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync } from 'node:fs';
import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth';
import path from 'node:path';
import { createWorkspaceContext, runWithWorkspace, WorkspaceContext, WorkspaceRole } from '../context/workspaceContext';
import { getAuthDatabase } from '../database/authDatabase';

interface MembershipRow { workspace_id: string; role: WorkspaceRole; status: string }

const requestWorkspaces = new WeakMap<Request, WorkspaceContext>();

export const bindAuthenticatedWorkspace = (request: Request, context: WorkspaceContext) => {
  requestWorkspaces.set(request, context);
};

const requestWorkspace = (request: Request) => {
  const context = requestWorkspaces.get(request);
  if (!context) throw new Error('WORKSPACE_CONTEXT_REQUIRED');
  return context;
};

export const authenticatedUploadPath = (request: Request, ...segments: string[]) =>
  path.join(requestWorkspace(request).uploadDirectory, ...segments);

export const resumeAuthenticatedWorkspace = (request: Request, response: Response, next: NextFunction) => {
  try {
    return runWithWorkspace(requestWorkspace(request), () => next());
  } catch {
    return response.status(403).json({ code: 'WORKSPACE_ACCESS_DENIED' });
  }
};

export const requireAuthenticatedWorkspace = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session?.user?.id) return response.status(401).json({ code: 'AUTHENTICATION_REQUIRED' });
    const membership = getAuthDatabase().prepare(`
      SELECT workspace_id, role, status FROM app_workspace_members WHERE user_id = ?
    `).get(session.user.id) as MembershipRow | undefined;
    if (!membership || membership.status !== 'active') return response.status(403).json({ code: 'WORKSPACE_ACCESS_DENIED' });
    const context = createWorkspaceContext(session.user.id, membership.workspace_id, membership.role);
    bindAuthenticatedWorkspace(request, context);
    mkdirSync(context.dataDirectory, { recursive: true });
    mkdirSync(context.uploadDirectory, { recursive: true });
    response.locals.authSession = session;
    response.locals.workspace = context;
    return runWithWorkspace(context, () => next());
  } catch {
    return response.status(401).json({ code: 'AUTHENTICATION_REQUIRED' });
  }
};

export const requireOwner = (_request: Request, response: Response, next: NextFunction) => {
  if (response.locals.workspace?.role !== 'owner') return response.status(403).json({ code: 'OWNER_REQUIRED' });
  next();
};
