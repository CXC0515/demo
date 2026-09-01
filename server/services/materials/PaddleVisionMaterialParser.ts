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
import { saveParserArtifact } from '../../repositories/parserArtifactRepository';
import { MaterialParser, MaterialParserError, MaterialParserInput } from './MaterialParser';
import { enhanceRecognitionPage } from './recognitionImagePreprocessor';

export interface PaddleVisionParserOptions {
  profile?: 'full' | 'schedule';
}

export class PaddleVisionMaterialParser implements MaterialParser {
  constructor(private readonly config: DocumentParserConfig, private readonly parserOptions: PaddleVisionParserOptions = {}) {}

  supports(input: MaterialParserInput) {
    return input.mimeType === 'application/pdf' || input.mimeType.startsWith('image/');
  }

  async parse(input: MaterialParserInput) {
    if (!this.config.paddleAccessToken) throw new MaterialParserError('PADDLEOCR_NOT_CONFIGURED');
    const scheduleProfile = this.parserOptions.profile === 'schedule';
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
          // Keep the upload geometry stable. Geometric correction is only safe once its transform
          // can be retained and applied consistently to source evidence.
          useDocOrientationClassify: false,
          useDocUnwarping: false,
          useLayoutDetection: true,
          useChartRecognition: !scheduleProfile,
          useOcrForImageBlock: true,
          mergeLayoutBlocks: false,
          layoutShapeMode: 'rect',
          prettifyMarkdown: true,
          showFormulaNumber: !scheduleProfile,
          returnMarkdownImages: !scheduleProfile
        }
      });
      if (!scheduleProfile) saveParserArtifact(input.assetId, {
        model: this.config.paddleModel || Model.PaddleOCRVL16,
        jobId: result.jobId,
        dataInfo: result.dataInfo,
        pages: result.pages.map((page, index) => ({
          pageNumber: index + 1,
          prunedResult: page.prunedResult,
          raw: page.raw,
          exports: page.exports,
          markdown: page.markdown,
          inputImageUrl: page.inputImageUrl
        }))
      });
      const resourceDirectory = path.resolve('var/uploads/parsed', input.assetId, 'resources');
      await mkdir(resourceDirectory, { recursive: true });
      const resourcePlans = scheduleProfile ? [] : result.pages.flatMap((page, pageIndex) => [
        ...(page.inputImageUrl ? [{
          fileName: `page-${pageIndex + 1}-source.jpg`,
          resourceUrl: page.inputImageUrl,
          role: 'source-page' as const,
          pageNumber: pageIndex + 1
        }] : []),
        ...Object.entries(page.markdownImages).map(([resourceName, resourceUrl], resourceIndex) => ({
          fileName: `page-${pageIndex + 1}-content-${resourceIndex + 1}${path.extname(resourceName) || '.jpg'}`,
          resourceUrl,
          role: 'content' as const,
          pageNumber: pageIndex + 1
        })),
        ...Object.entries(page.outputImages).map(([resourceName, resourceUrl], resourceIndex) => ({
          fileName: `page-${pageIndex + 1}-${resourceName.replace(/[^a-zA-Z0-9._-]/g, '-')}-${resourceIndex + 1}${path.extname(new URL(resourceUrl).pathname) || '.jpg'}`,
          resourceUrl,
          role: 'layout-visualization' as const,
          pageNumber: pageIndex + 1
        }))
      ]);
      const savedResources = await Promise.all(resourcePlans.map(async plan => ({
        ...plan,
        resourcePath: await client.saveResource(plan.resourceUrl, resourceDirectory, {
          overwrite: true,
          filename: plan.fileName
        })
      })));
      if (!scheduleProfile) await Promise.all(savedResources
        .filter(resource => resource.role === 'source-page')
        .map(resource => enhanceRecognitionPage(resource.resourcePath)));
      const warnings = result.pages.flatMap((page, index) => page.markdownText.trim() ? [] : [{
        code: 'PADDLEOCR_EMPTY_PAGE',
        message: `第 ${index + 1} 页没有生成可用的 Markdown。`
      }]);
      return {
        assetId: input.assetId,
        sourceFormat: input.mimeType === 'application/pdf' ? 'pdf' as const : 'image' as const,
        markdown: result.pages.map(page => page.markdownText).join('\n\n'),
        blocks: result.pages.flatMap((page, pageIndex) => {
          const pageResult = page.prunedResult as {
            width: number;
            height: number;
            parsing_res_list: Array<{
              block_id: number;
              block_order?: number | null;
              block_label: string;
              block_content: string;
              block_bbox: [number, number, number, number];
            }>;
          };
          const pageWidth = pageResult.width;
          const pageHeight = pageResult.height;
          return pageResult.parsing_res_list
            .filter(block => block.block_content.trim())
            .map((block, blockIndex) => {
              const [left, top, right, bottom] = block.block_bbox;
              const type = block.block_label.includes('title')
                ? 'heading' as const
                : block.block_label.includes('formula')
                  ? 'formula' as const
                  : block.block_label.includes('table')
                    ? 'table' as const
                    : 'paragraph' as const;
              return {
                id: `page-${pageIndex + 1}-block-${block.block_id}`,
                order: pageIndex * 10_000 + (block.block_order ?? blockIndex),
                type,
                text: block.block_content.trim(),
                markdown: block.block_content.trim(),
                pageNumber: pageIndex + 1,
                boundingBox: {
                  x: left / pageWidth,
                  y: top / pageHeight,
                  width: (right - left) / pageWidth,
                  height: (bottom - top) / pageHeight
                }
              };
            });
        }),
        resources: savedResources.map(resource => ({
          id: randomUUID(),
          fileName: path.basename(resource.resourcePath),
          mimeType: path.extname(resource.resourcePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg',
          publicUrl: `/uploads/parsed/${input.assetId}/resources/${encodeURIComponent(path.basename(resource.resourcePath))}`,
          role: resource.role,
          pageNumber: resource.pageNumber
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
