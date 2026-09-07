/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import path from 'node:path';
import { createInvitation } from '../auth/invitations';
import { initializeAuth } from '../auth/auth';
import { ensureRuntimeDirectories, runtimeConfig } from '../config/runtimeConfig';
import { closeAuthDatabase } from '../database/authDatabase';
import { restoreAppDataSnapshot, verifyAppData } from '../services/operations/dataSnapshot';

const [snapshotArgument, ownerEmail, ownerName = '管理员'] = process.argv.slice(2);
if (!snapshotArgument || !ownerEmail) {
  throw new Error('Usage: APP_DATA_ROOT=<new-root> npm run migrate:legacy-workspace -- <verified-snapshot> <owner-email> [owner-name]');
}
ensureRuntimeDirectories();
await initializeAuth();
const invitation = createInvitation({ email: ownerEmail, displayName: ownerName, role: 'owner', expiresInHours: 72 });
const workspaceRoot = path.join(runtimeConfig.workspacesDirectory, invitation.workspaceId);
const report = await restoreAppDataSnapshot(path.resolve(snapshotArgument), workspaceRoot);
const verification = await verifyAppData(workspaceRoot);
const url = new URL('/register', runtimeConfig.appUrl);
url.searchParams.set('token', invitation.token);
url.searchParams.set('email', ownerEmail.trim().toLowerCase());
process.stdout.write(`${JSON.stringify({
  event: 'legacy_workspace_candidate_created',
  candidateRoot: runtimeConfig.dataRoot,
  workspaceRoot,
  invitationUrl: url.toString(),
  verification,
  restoreReport: report,
}, null, 2)}\n`);
closeAuthDatabase();
