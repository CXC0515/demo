/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MaterialParser, MaterialParserInput } from './MaterialParser';

export class TextMaterialParser implements MaterialParser {
  supports(input: MaterialParserInput) {
    return input.mimeType.startsWith('text/') || path.extname(input.fileName).toLowerCase() === '.txt';
  }

  async parse(input: MaterialParserInput) {
    const markdown = (await readFile(input.filePath, 'utf8')).replace(/^\uFEFF/, '');
    const blocks = markdown.split(/\r?\n/).flatMap((line, index) => {
      const text = line.trim();
      return text ? [{ id: `block-${index + 1}`, order: index, type: 'paragraph' as const, text, markdown: text }] : [];
    });
    return {
      assetId: input.assetId,
      sourceFormat: 'text' as const,
      markdown,
      blocks,
      resources: [],
      warnings: [],
      parsedAt: new Date().toISOString()
    };
  }
}
