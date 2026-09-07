/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync } from 'node:fs';
import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth';
import { createWorkspaceContext, runWithWorkspace, WorkspaceRole } from '../context/workspaceContext';
import { getAuthDatabase } from '../database/authDatabase';

interface MembershipRow { workspace_id: string; role: WorkspaceRole; status: string }

export const requireAuthenticatedWorkspace = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session?.user?.id) return response.status(401).json({ code: 'AUTHENTICATION_REQUIRED' });
    const membership = getAuthDatabase().prepare(`
      SELECT workspace_id, role, status FROM app_workspace_members WHERE user_id = ?
    `).get(session.user.id) as MembershipRow | undefined;
    if (!membership || membership.status !== 'active') return response.status(403).json({ code: 'WORKSPACE_ACCESS_DENIED' });
    const context = createWorkspaceContext(session.user.id, membership.workspace_id, membership.role);
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
