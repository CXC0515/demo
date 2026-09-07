/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { runtimeConfig } from '../config/runtimeConfig';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'self'", 'blob:'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: runtimeConfig.production ? [] : null,
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  strictTransportSecurity: runtimeConfig.production,
});

export const registrationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
