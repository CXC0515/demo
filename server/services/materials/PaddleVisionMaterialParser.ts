/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  AuthError,
  InvalidRequestError,
  Model,
  PaddleOCRClient,
  PollTimeoutError,
  RateLimitError,
  RequestTimeoutError
} from '@paddleocr/api-sdk';
import { DocumentParserConfig } from '../../config/documentParserConfig';
import { MaterialParser, MaterialParserError, MaterialParserInput } from './MaterialParser';

export class PaddleVisionMaterialParser implements MaterialParser {
  constructor(private readonly config: DocumentParserConfig) {}

  supports(input: MaterialParserInput) {
    return input.mimeType === 'application/pdf' || input.mimeType.startsWith('image/');
  }

  async parse(input: MaterialParserInput) {
    if (!this.config.paddleAccessToken) throw new MaterialParserError('PADDLEOCR_NOT_CONFIGURED');
    const client = new PaddleOCRClient({
      token: this.config.paddleAccessToken,
      baseUrl: this.config.paddleBaseUrl,
      requestTimeout: 300_000,
      pollTimeout: 900_000
    });
    try {
      const result = await client.parseDocument({
        filePath: input.filePath,
        model: this.config.paddleModel || Model.PaddleOCRVL16,
        options: {
          useLayoutDetection: true,
          useChartRecognition: true,
          prettifyMarkdown: true,
          showFormulaNumber: true,
          returnMarkdownImages: true
        }
      });
      const resourceDirectory = path.resolve('var/uploads/parsed', input.assetId, 'resources');
      await mkdir(resourceDirectory, { recursive: true });
      const resourcePlans = result.pages.flatMap((page, pageIndex) => [
        ...Object.entries(page.markdownImages).map(([resourceName, resourceUrl], resourceIndex) => ({
          fileName: `page-${pageIndex + 1}-content-${resourceIndex + 1}${path.extname(resourceName) || '.jpg'}`,
          resourceUrl
        })),
        ...Object.entries(page.outputImages).map(([resourceName, resourceUrl], resourceIndex) => ({
          fileName: `page-${pageIndex + 1}-${resourceName.replace(/[^a-zA-Z0-9._-]/g, '-')}-${resourceIndex + 1}${path.extname(new URL(resourceUrl).pathname) || '.jpg'}`,
          resourceUrl
        }))
      ]);
      const savedResources = await Promise.all(resourcePlans.map(plan => client.saveResource(plan.resourceUrl, resourceDirectory, {
        overwrite: true,
        filename: plan.fileName
      })));
      const warnings = result.pages.flatMap((page, index) => page.markdownText.trim() ? [] : [{
        code: 'PADDLEOCR_EMPTY_PAGE',
        message: `第 ${index + 1} 页没有生成可用的 Markdown。`
      }]);
      return {
        assetId: input.assetId,
        sourceFormat: input.mimeType === 'application/pdf' ? 'pdf' as const : 'image' as const,
        markdown: result.pages.map(page => page.markdownText).join('\n\n'),
        blocks: result.pages.map((page, index) => ({
          id: `page-${index + 1}`,
          order: index,
          type: 'page' as const,
          text: page.markdownText,
          markdown: page.markdownText,
          pageNumber: index + 1
        })),
        resources: savedResources.map(resourcePath => ({
          id: randomUUID(),
          fileName: path.basename(resourcePath),
          mimeType: path.extname(resourcePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg',
          publicUrl: `/uploads/parsed/${input.assetId}/resources/${encodeURIComponent(path.basename(resourcePath))}`
        })),
        warnings,
        pageCount: result.pages.length,
        parsedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof AuthError) throw new MaterialParserError('PADDLEOCR_AUTH_FAILED', { cause: error });
      if (error instanceof InvalidRequestError) throw new MaterialParserError('PADDLEOCR_INVALID_REQUEST', { cause: error });
      if (error instanceof RateLimitError) throw new MaterialParserError('PADDLEOCR_RATE_LIMITED', { cause: error });
      if (error instanceof PollTimeoutError || error instanceof RequestTimeoutError) throw new MaterialParserError('PADDLEOCR_TIMEOUT', { cause: error });
      if (error instanceof MaterialParserError) throw error;
      throw new MaterialParserError('PADDLEOCR_PARSE_FAILED', { cause: error });
    }
  }
}
