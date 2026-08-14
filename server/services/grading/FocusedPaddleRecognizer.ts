/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Model, PaddleOCRClient } from '@paddleocr/api-sdk';
import { DocumentParserConfig } from '../../config/documentParserConfig';
import { withPaddleRequestSlot } from '../materials/paddleRequestLimiter';

interface FocusedPaddlePage {
  markdownText?: string;
  prunedResult?: unknown;
}

export const extractFocusedPaddleText = (pages: FocusedPaddlePage[]) => pages
  .flatMap(page => {
    const result = page.prunedResult as { parsing_res_list?: Array<{ block_content?: string; block_bbox?: number[] }> } | undefined;
    const blocks = result?.parsing_res_list
      ?.filter(block => block.block_content?.trim())
      .sort((first, second) => (first.block_bbox?.[1] ?? 0) - (second.block_bbox?.[1] ?? 0) || (first.block_bbox?.[0] ?? 0) - (second.block_bbox?.[0] ?? 0))
      .map(block => block.block_content!.trim()) ?? [];
    return blocks.length ? blocks : [page.markdownText?.trim() ?? ''];
  })
  .filter(Boolean)
  .join('\n')
  .trim();

export class FocusedPaddleRecognizer {
  constructor(private readonly config: DocumentParserConfig) {}

  async recognize(cropPath: string) {
    if (!this.config.paddleAccessToken) throw new Error('PADDLEOCR_NOT_CONFIGURED');
    const client = new PaddleOCRClient({
      token: this.config.paddleAccessToken,
      baseUrl: this.config.paddleBaseUrl,
      requestTimeout: 300_000,
      pollTimeout: 900_000
    });
    const result = await withPaddleRequestSlot(() => client.parseDocument({
      filePath: cropPath,
      model: this.config.paddleModel || Model.PaddleOCRVL16,
      options: {
        useDocOrientationClassify: false,
        useDocUnwarping: false,
        useLayoutDetection: false,
        promptLabel: 'ocr',
        mergeLayoutBlocks: false
      }
    }));
    return extractFocusedPaddleText(result.pages);
  }
}
