/** @license SPDX-License-Identifier: Apache-2.0 */

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});
