/** @license SPDX-License-Identifier: Apache-2.0 */

import { AsyncLocalStorage } from 'node:async_hooks';

const capture = new AsyncLocalStorage<{ url?: string }>();
export const capturePasswordResetUrl = async (callback: () => Promise<void>) => {
  const state: { url?: string } = {};
  await capture.run(state, callback);
  return state.url;
};
export const recordPasswordResetUrl = (url: string) => {
  const state = capture.getStore();
  if (state) state.url = url;
};
