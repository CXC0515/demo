/** @license SPDX-License-Identifier: Apache-2.0 */

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const root = await mkdtemp(path.join(os.tmpdir(), 'demo-auth-integration-'));
const origin = 'http://127.0.0.1:4399';
process.env.APP_DATA_ROOT = root;
process.env.APP_URL = origin;
process.env.API_PORT = '4399';
const { initializeAuth } = await import('./auth');
const { createInvitation } = await import('./invitations');
const { createApp } = await import('../app');
const { closeAuthDatabase, getAuthDatabase } = await import('../database/authDatabase');
const { closeRosterDatabase } = await import('../database/rosterDatabase');
const { closeResourceDatabase } = await import('../database/resourceDatabase');
await initializeAuth();
const server = createApp().listen(4399, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  closeRosterDatabase(); closeResourceDatabase(); closeAuthDatabase();
  await rm(root, { recursive: true, force: true });
});

const mutationHeaders = { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'x-demo-csrf': '1', 'Content-Type': 'application/json' };
const register = async (email: string, invitedName: string, registeredName: string, role: 'owner' | 'teacher') => {
  const invitation = createInvitation({ email, displayName: invitedName, role });
  const password = `${registeredName}-secure-password-123`;
  const response = await fetch(`${origin}/api/register`, { method: 'POST', headers: mutationHeaders, body: JSON.stringify({ token: invitation.token, email, name: registeredName, password }) });
  assert.equal(response.status, 201);
  assert.equal(response.headers.getSetCookie().length, 0);
  const sessionCount = getAuthDatabase().prepare(`
    SELECT COUNT(*) AS count FROM session
    WHERE userId = (SELECT id FROM user WHERE email = ?)
  `).get(email) as { count: number };
  assert.equal(sessionCount.count, 0);
  assert.equal((await fetch(`${origin}/api/account`)).status, 401);
  const login = await fetch(`${origin}/api/auth/sign-in/email`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie()[0]?.split(';', 1)[0];
  assert.ok(cookie);
  return { cookie, invitation };
};

test('invited accounts receive isolated business APIs and owner-only administration', async () => {
  assert.equal((await fetch(`${origin}/api/roster`)).status, 401);
  assert.equal((await fetch(`${origin}/api/auth/sign-up/email/`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  const owner = await register('owner@example.com', '邀请时姓名', 'Cleo', 'owner');
  const teacher = await register('teacher@example.com', '受邀教师', '新教师', 'teacher');
  assert.notEqual(owner.invitation.workspaceId, teacher.invitation.workspaceId);
  const ownerAccount = await (await fetch(`${origin}/api/account`, { headers: { Cookie: owner.cookie } })).json() as { user: { name: string }; profile: { nickname: string; realName: string } };
  assert.equal(ownerAccount.user.name, 'Cleo');
  assert.equal(ownerAccount.profile.nickname, 'Cleo');
  assert.equal(ownerAccount.profile.realName, 'Cleo');
  const createClass = await fetch(`${origin}/api/classes`, { method: 'POST', headers: { ...mutationHeaders, Cookie: owner.cookie }, body: JSON.stringify({ name: '仅所有者可见', grade: '七年级', term: '2026', headTeacher: '甲', chineseTeacher: '甲', status: 'active' }) });
  assert.equal(createClass.status, 201);
  const ownerRoster = await (await fetch(`${origin}/api/roster`, { headers: { Cookie: owner.cookie } })).json() as { classes: unknown[] };
  const teacherRoster = await (await fetch(`${origin}/api/roster`, { headers: { Cookie: teacher.cookie } })).json() as { classes: unknown[] };
  assert.equal(ownerRoster.classes.length, 1);
  assert.equal(teacherRoster.classes.length, 0);
  assert.equal((await fetch(`${origin}/api/admin/accounts`, { headers: { Cookie: teacher.cookie } })).status, 403);
  assert.equal((await fetch(`${origin}/api/classes`, { method: 'POST', headers: { Origin: origin, Cookie: teacher.cookie, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
});
