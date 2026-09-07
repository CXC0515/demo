/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../auth/auth';
import { consumeInvitation, findPendingInvitation, normalizeEmail } from '../auth/invitations';
import { registrationRateLimit } from '../middleware/security';

const router = Router();
const registrationSchema = z.object({
  token: z.string().min(32).max(256),
  email: z.email().max(320),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(12).max(128),
});

router.post('/register', registrationRateLimit, async (request, response) => {
  const parsed = registrationSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ code: 'INVALID_REGISTRATION' });
  const email = normalizeEmail(parsed.data.email);
  const invitation = findPendingInvitation(parsed.data.token, email);
  if (!invitation) return response.status(400).json({ code: 'INVALID_OR_EXPIRED_INVITATION' });
  try {
    const result = await auth.api.signUpEmail({ body: { email, name: parsed.data.name, password: parsed.data.password } });
    consumeInvitation(invitation, result.user.id);
    return response.status(201).json({ ok: true });
  } catch {
    return response.status(400).json({ code: 'REGISTRATION_FAILED' });
  }
});

export default router;
