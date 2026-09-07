/** @license SPDX-License-Identifier: Apache-2.0 */

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (mutatingMethods.has(method)) headers.set('x-demo-csrf', '1');
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
};
