/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';
import { runtimeConfig } from '../config/runtimeConfig';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const expectedOrigin = new URL(runtimeConfig.appUrl).origin;

export const requireSameOriginMutation = (request: Request, response: Response, next: NextFunction) => {
  if (safeMethods.has(request.method)) return next();
  const origin = request.header('origin');
  const fetchSite = request.header('sec-fetch-site');
  if (origin !== expectedOrigin || (fetchSite && fetchSite !== 'same-origin')) {
    return response.status(403).json({ code: 'CSRF_CHECK_FAILED' });
  }
  if (request.header('x-demo-csrf') !== '1') return response.status(403).json({ code: 'CSRF_CHECK_FAILED' });
  next();
};
