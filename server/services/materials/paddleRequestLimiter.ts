/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const maxConcurrentRequests = 2;
let activeRequests = 0;
const waiters: Array<() => void> = [];

const acquire = async () => {
  if (activeRequests < maxConcurrentRequests) {
    activeRequests += 1;
    return;
  }
  await new Promise<void>(resolve => waiters.push(resolve));
  activeRequests += 1;
};

const release = () => {
  activeRequests -= 1;
  waiters.shift()?.();
};

export const withPaddleRequestSlot = async <T>(request: () => Promise<T>) => {
  await acquire();
  try {
    return await request();
  } finally {
    release();
  }
};
