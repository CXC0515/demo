/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const extractJson = (value: string) => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = (fenced ?? value).trim();
  const start = source.search(/[\[{]/);
  if (start < 0) throw new Error('MODEL_JSON_NOT_FOUND');
  const opening = source[start];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === opening) depth += 1;
    else if (character === closing && --depth === 0) return JSON.parse(source.slice(start, index + 1));
  }
  throw new Error('MODEL_JSON_INCOMPLETE');
};
