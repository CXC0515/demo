/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { getAuthDatabase } from '../database/authDatabase';
import { runtimeConfig } from '../config/runtimeConfig';
import { recordPasswordResetUrl } from './passwordResetCapture';

const authOptions = {
  appName: '教师工作台',
  database: getAuthDatabase(),
  baseURL: runtimeConfig.appUrl,
  secret: runtimeConfig.authSecret,
  trustedOrigins: [new URL(runtimeConfig.appUrl).origin],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 30 * 60,
    sendResetPassword: async ({ url }) => recordPasswordResetUrl(url),
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: runtimeConfig.production,
    cookiePrefix: 'demo_teacher',
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip', 'x-real-ip'],
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      '/sign-in/email': { window: 60, max: 8 },
      '/forget-password': { window: 300, max: 3 },
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export const initializeAuth = async () => {
  const migrations = await getMigrations(authOptions);
  await migrations.runMigrations();
};
