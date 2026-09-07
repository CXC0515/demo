/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { getAuthDatabase } from '../database/authDatabase';
import { workspacePaths, WorkspaceRole } from '../context/workspaceContext';

interface InvitationRow {
  id: string;
  email: string;
  display_name: string;
  token_hash: string;
  role: WorkspaceRole;
  workspace_id: string;
  status: 'pending' | 'consumed' | 'revoked';
  expires_at: string;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const hashInvitationToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const createInvitation = (input: {
  email: string;
  displayName: string;
  role?: WorkspaceRole;
  createdByUserId?: string;
  expiresInHours?: number;
}) => {
  const token = randomBytes(32).toString('base64url');
  const id = randomUUID();
  const workspaceId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.expiresInHours ?? 72) * 60 * 60 * 1000);
  getAuthDatabase().prepare(`
    INSERT INTO app_invitations
      (id, email, display_name, token_hash, role, workspace_id, expires_at, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, normalizeEmail(input.email), input.displayName.trim(), hashInvitationToken(token), input.role ?? 'teacher',
    workspaceId, expiresAt.toISOString(), input.createdByUserId ?? null, now.toISOString());
  return { id, token, workspaceId, expiresAt: expiresAt.toISOString() };
};

export const findPendingInvitation = (token: string, email: string) => getAuthDatabase().prepare(`
  SELECT * FROM app_invitations
  WHERE token_hash = ? AND email = ? AND status = 'pending' AND expires_at > ?
`).get(hashInvitationToken(token), normalizeEmail(email), new Date().toISOString()) as InvitationRow | undefined;

export const consumeInvitation = (invitation: InvitationRow, userId: string) => {
  const now = new Date().toISOString();
  const paths = workspacePaths(invitation.workspace_id);
  mkdirSync(paths.dataDirectory, { recursive: true });
  mkdirSync(paths.uploadDirectory, { recursive: true });
  getAuthDatabase().transaction(() => {
    getAuthDatabase().prepare(`
      INSERT INTO app_workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
    `).run(invitation.workspace_id, `${invitation.display_name}的工作区`, now, now);
    getAuthDatabase().prepare(`
      INSERT INTO app_workspace_members (user_id, workspace_id, role, created_at) VALUES (?, ?, ?, ?)
    `).run(userId, invitation.workspace_id, invitation.role, now);
    getAuthDatabase().prepare(`
      INSERT INTO app_teacher_profiles (user_id, profile_json, updated_at) VALUES (?, ?, ?)
    `).run(userId, JSON.stringify({ nickname: invitation.display_name, realName: invitation.display_name }), now);
    const result = getAuthDatabase().prepare(`
      UPDATE app_invitations SET status = 'consumed', consumed_by_user_id = ?, consumed_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(userId, now, invitation.id);
    if (result.changes !== 1) throw new Error('INVITATION_ALREADY_USED');
  })();
};
