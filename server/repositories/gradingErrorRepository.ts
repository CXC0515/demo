/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const dataDirectory = path.resolve('var/data');
const dataPath = path.join(dataDirectory, 'ai-grading-errors.jsonl');
mkdirSync(dataDirectory, { recursive: true });

export const recordGradingError = (event: string, taskId: string, error: unknown, context: Record<string, unknown> = {}) => {
  const message = error instanceof Error ? error.message : String(error);
  appendFileSync(dataPath, `${JSON.stringify({ at: new Date().toISOString(), event, taskId, message, context })}\n`);
};
