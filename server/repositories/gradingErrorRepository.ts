/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { dataFilePath } from '../context/workspaceContext';

export const recordGradingError = (event: string, taskId: string, error: unknown, context: Record<string, unknown> = {}) => {
  const message = error instanceof Error ? error.message : String(error);
  const dataPath = dataFilePath('ai-grading-errors.jsonl');
  mkdirSync(path.dirname(dataPath), { recursive: true });
  appendFileSync(dataPath, `${JSON.stringify({ at: new Date().toISOString(), event, taskId, message, context })}\n`);
};
