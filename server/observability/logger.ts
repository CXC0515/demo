/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const sensitiveKey = /(authorization|cookie|password|secret|token|api[-_]?key|content|ocr|student|email|file[-_]?name)/i;

const redactText = (value: string) => value
  .replace(/([?&](?:token|key|code|secret)=)[^&\s]+/gi, '$1[REDACTED]')
  .replace(/(bearer\s+)[^\s]+/gi, '$1[REDACTED]')
  .slice(0, 500);

const safeValue = (key: string, value: unknown): unknown => {
  if (sensitiveKey.test(key)) return '[REDACTED]';
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue('', item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, safeValue(nestedKey, nestedValue)]));
  }
  return value;
};

export const logEvent = (
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown> = {},
) => {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, safeValue(key, value)])),
  };
  const output = JSON.stringify(record);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
};
