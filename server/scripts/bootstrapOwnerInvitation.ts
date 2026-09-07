/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import { createInvitation } from '../auth/invitations';
import { initializeAuth } from '../auth/auth';
import { runtimeConfig } from '../config/runtimeConfig';
import { closeAuthDatabase } from '../database/authDatabase';

const [email, displayName = '管理员'] = process.argv.slice(2);
if (!email) throw new Error('Usage: npm run auth:invite-owner -- owner@example.com "显示名称"');
await initializeAuth();
const invitation = createInvitation({ email, displayName, role: 'owner', expiresInHours: 72 });
const url = new URL('/register', runtimeConfig.appUrl);
url.searchParams.set('token', invitation.token);
url.searchParams.set('email', email.trim().toLowerCase());
process.stdout.write(`${url.toString()}\n`);
closeAuthDatabase();
