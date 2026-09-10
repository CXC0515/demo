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
import { uploadFilePath } from '../../context/workspaceContext';
import { mergeParserArtifactPages } from '../../repositories/parserArtifactRepository';
import { MaterialParser, MaterialParserError, MaterialParserInput } from './MaterialParser';
import { enhanceRecognitionPage } from './recognitionImagePreprocessor';

export interface PaddleVisionParserOptions {
  profile?: 'full' | 'schedule';
}

export const normalizePaddleBlockType = (sourceType: string) => sourceType.toLowerCase().includes('title')
  ? 'heading' as const
  : sourceType.toLowerCase().includes('formula')
    ? 'formula' as const
    : sourceType.toLowerCase().includes('table')
      ? 'table' as const
      : sourceType.toLowerCase().includes('image')
        ? 'image' as const
        : sourceType.toLowerCase().includes('list')
          ? 'list-item' as const
          : 'paragraph' as const;

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
      const metrics = {} as NonNullable<Awaited<ReturnType<MaterialParser['parse']>>['processingMetrics']>;
      input.onProgress?.('uploading', metrics);
      const uploadStartedAt = performance.now();
      const job = await client.submitDocumentParsing({
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
          prettifyMarkdown: !scheduleProfile,
          showFormulaNumber: !scheduleProfile,
          returnMarkdownImages: !scheduleProfile
        }
      });
      metrics.uploadingMs = Math.round(performance.now() - uploadStartedAt);
      input.onProgress?.('recognizing', metrics);
      const recognizingStartedAt = performance.now();
      const result = await client.waitDocumentParsingResult(job);
      metrics.recognizingMs = Math.round(performance.now() - recognizingStartedAt);
      const pageOffset = input.pageOffset ?? 0;
      if (!scheduleProfile) mergeParserArtifactPages(input.assetId, {
        model: this.config.paddleModel || Model.PaddleOCRVL16,
        jobId: result.jobId,
        dataInfo: result.dataInfo,
        pages: result.pages.map((page, index) => ({
          pageNumber: pageOffset + index + 1,
          prunedResult: page.prunedResult,
          raw: page.raw,
          exports: page.exports,
          markdown: page.markdown,
          inputImageUrl: page.inputImageUrl
        }))
      });
      const resourceDirectory = uploadFilePath('parsed', input.assetId, 'resources');
      const pageImageDirectory = uploadFilePath('parsed', input.assetId, 'page-images');
      await Promise.all([mkdir(resourceDirectory, { recursive: true }), mkdir(pageImageDirectory, { recursive: true })]);
      const resourcePlans = scheduleProfile ? [] : result.pages.flatMap((page, pageIndex) => [
        ...(page.inputImageUrl ? [{
          fileName: `page-${pageOffset + pageIndex + 1}-source.jpg`,
          sourceName: `input-page-${pageOffset + pageIndex + 1}`,
          resourceUrl: page.inputImageUrl,
          role: 'source-page' as const,
          pageNumber: pageOffset + pageIndex + 1
        }] : []),
        ...Object.entries(page.markdownImages).map(([resourceName, resourceUrl], resourceIndex) => ({
          fileName: `page-${pageOffset + pageIndex + 1}-content-${resourceIndex + 1}${path.extname(resourceName) || '.jpg'}`,
          sourceName: resourceName,
          resourceUrl,
          role: 'content' as const,
          pageNumber: pageOffset + pageIndex + 1
        })),
        ...Object.entries(page.outputImages).map(([resourceName, resourceUrl], resourceIndex) => ({
          fileName: `page-${pageOffset + pageIndex + 1}-${resourceName.replace(/[^a-zA-Z0-9._-]/g, '-')}-${resourceIndex + 1}${path.extname(new URL(resourceUrl).pathname) || '.jpg'}`,
          sourceName: resourceName,
          resourceUrl,
          role: 'layout-visualization' as const,
          pageNumber: pageOffset + pageIndex + 1
        }))
      ]);
      input.onProgress?.('downloading', metrics);
      const downloadingStartedAt = performance.now();
      const savedResources = await Promise.all(resourcePlans.map(async plan => ({
        ...plan,
        resourcePath: await client.saveResource(
          plan.resourceUrl,
          plan.role === 'source-page'
            ? path.join(pageImageDirectory, `page-${plan.pageNumber}.jpg`)
            : path.join(resourceDirectory, plan.fileName),
          { overwrite: true }
        )
      })));
      metrics.downloadingMs = Math.round(performance.now() - downloadingStartedAt);
      input.onProgress?.('enhancing', metrics);
      const enhancingStartedAt = performance.now();
      if (!scheduleProfile) {
        await Promise.all(savedResources
          .filter(resource => resource.role === 'source-page')
          .map(resource => enhanceRecognitionPage(resource.resourcePath)));
      }
      metrics.enhancingMs = Math.round(performance.now() - enhancingStartedAt);
      const warnings = result.pages.flatMap((page, index) => page.markdownText.trim() ? [] : [{
        code: 'PADDLEOCR_EMPTY_PAGE',
        message: `第 ${index + 1} 页没有生成可用的 Markdown。`
      }]);
      const publicUrlForResource = (resource: typeof savedResources[number]) => input.publicAssetBaseUrl
        ? resource.role === 'source-page'
          ? `${input.publicAssetBaseUrl}/pages/${resource.pageNumber}/image`
          : `${input.publicAssetBaseUrl}/derived/resources/${encodeURIComponent(path.basename(resource.resourcePath))}`
        : '';
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
          const pageBlocks = pageResult.parsing_res_list.filter(block => block.block_content.trim());
          const pageContentResources = savedResources.filter(resource => resource.role === 'content' && resource.pageNumber === pageOffset + pageIndex + 1);
          return pageBlocks.map((block, blockIndex) => {
              const [left, top, right, bottom] = block.block_bbox;
              const type = normalizePaddleBlockType(block.block_label);
              const explicitlyLinkedResources = pageContentResources.filter(resource => block.block_content.includes(resource.sourceName));
              const imageOrdinal = type === 'image'
                ? pageBlocks.slice(0, blockIndex + 1).filter(candidate => normalizePaddleBlockType(candidate.block_label) === 'image').length - 1
                : -1;
              const blockResourceUrls = (explicitlyLinkedResources.length
                ? explicitlyLinkedResources
                : type === 'image' && pageContentResources[imageOrdinal]
                  ? [pageContentResources[imageOrdinal]]
                  : [])
                .map(publicUrlForResource);
              return {
                id: `page-${pageIndex + 1}-block-${block.block_id}`,
                order: pageIndex * 10_000 + (block.block_order ?? blockIndex),
                type,
                sourceType: block.block_label,
                text: block.block_content.trim(),
                markdown: block.block_content.trim(),
                resourceUrls: blockResourceUrls,
                pageNumber: pageOffset + pageIndex + 1,
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
          publicUrl: input.publicAssetBaseUrl
            ? publicUrlForResource(resource)
            : '',
          role: resource.role,
          pageNumber: resource.pageNumber
        })),
        warnings,
        pageCount: result.pages.length,
        parsedAt: new Date().toISOString(),
        processingMetrics: metrics
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
