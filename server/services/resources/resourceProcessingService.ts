/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import type { ResourceProcessingMetrics } from "../../../src/domain/types";
import { getModelConfig } from "../../config/modelConfig";
import { resourceRepository } from "../../repositories/resourceRepository";
import { MaterialParserError } from "../materials/MaterialParser";
import { parseMaterial } from "../materials/materialParserRegistry";
import { buildResourceChunks, ResourceAnalyzer } from "./resourceAnalyzer";

export const readPdfPageCount = async (filePath: string) => {
  const source = await readFile(filePath);
  const document = await PDFDocument.load(source, { updateMetadata: false });
  return document.getPageCount();
};

const createPageRangePdf = async (
  filePath: string,
  resourceId: string,
  pageStart: number,
  pageEnd: number,
) => {
  const source = await PDFDocument.load(await readFile(filePath), {
    updateMetadata: false,
  });
  const output = await PDFDocument.create();
  const pageIndexes = Array.from(
    { length: pageEnd - pageStart + 1 },
    (_, index) => pageStart - 1 + index,
  );
  const pages = await output.copyPages(source, pageIndexes);
  pages.forEach((page) => output.addPage(page));
  const temporaryPath = path.resolve(
    "var/uploads/resources",
    `${resourceId}-pages-${pageStart}-${pageEnd}.pdf`,
  );
  await writeFile(temporaryPath, await output.save());
  return temporaryPath;
};

export const getResourcePagePdfPath = async (resourceId: string, pageNumber: number) => {
  const resource = resourceRepository.getStoredResource(resourceId);
  if (!resource) throw new Error("RESOURCE_NOT_FOUND");
  if (!resource.pageCount || pageNumber < 1 || pageNumber > resource.pageCount) throw new Error("INVALID_PAGE_NUMBER");
  const previewDirectory = path.resolve("var/uploads/parsed", resourceId, "previews");
  const previewPath = path.join(previewDirectory, `page-${pageNumber}.pdf`);
  try {
    await access(previewPath);
    return previewPath;
  } catch {
    await mkdir(previewDirectory, { recursive: true });
    const source = await PDFDocument.load(await readFile(resource.diskPath), { updateMetadata: false });
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [pageNumber - 1]);
    output.addPage(page);
    await writeFile(previewPath, await output.save());
    return previewPath;
  }
};

export const processLibraryResource = async (
  resourceId: string,
  pageStart: number,
  pageEnd: number,
  jobId: string,
) => {
  const processingStartedAt = performance.now();
  const resource = resourceRepository.getStoredResource(resourceId);
  if (!resource) throw new Error("RESOURCE_NOT_FOUND");
  if (resource.mimeType !== "application/pdf")
    throw new Error("RESOURCE_FORMAT_UNSUPPORTED");
  if (
    !resource.pageCount ||
    pageStart < 1 ||
    pageEnd < pageStart ||
    pageEnd > resource.pageCount ||
    pageEnd - pageStart > 39
  ) {
    throw new Error("INVALID_PAGE_RANGE");
  }
  let temporaryPath = "";
  let ocrAvailable = false;
  let metrics: ResourceProcessingMetrics = {};
  try {
    resourceRepository.updateProcessingJob(jobId, { stage: "preparing", phase: "pdf-extraction" });
    const extractionStartedAt = performance.now();
    temporaryPath = await createPageRangePdf(
      resource.diskPath,
      resourceId,
      pageStart,
      pageEnd,
    );
    metrics.pdfExtractionMs = Math.round(performance.now() - extractionStartedAt);
    resourceRepository.updateProcessingJob(jobId, { stage: "ocr", phase: "uploading", metrics });
    const normalizedDocument = await parseMaterial({
      assetId: resource.id,
      fileName: resource.fileName,
      mimeType: resource.mimeType,
      filePath: temporaryPath,
      pageOffset: pageStart - 1,
      onProgress: (phase, parserMetrics) => {
        metrics = { ...metrics, ...parserMetrics };
        resourceRepository.updateProcessingJob(jobId, { stage: "ocr", phase, metrics });
      },
    });
    metrics = { ...metrics, ...normalizedDocument.processingMetrics };
    const publicResource = resourceRepository.getStoredResource(resourceId)!;
    const chunks = buildResourceChunks(
      publicResource,
      normalizedDocument,
      0,
    );
    const analyzer = new ResourceAnalyzer(getModelConfig());
    resourceRepository.updateProcessingJob(jobId, { stage: "saving", phase: "ocr-saving", metrics });
    const ocrSavingStartedAt = performance.now();
    resourceRepository.mergeChunksForPages(resourceId, pageStart, pageEnd, chunks);
    metrics.ocrSavingMs = Math.round(performance.now() - ocrSavingStartedAt);
    resourceRepository.updateProcessingJob(jobId, { stage: "saving", phase: "rag-indexing", metrics });
    const ragIndexingStartedAt = performance.now();
    resourceRepository.markResourcePagesRag(resourceId, pageStart, pageEnd, "indexing");
    resourceRepository.markResourcePagesRag(resourceId, pageStart, pageEnd, "indexed");
    resourceRepository.markResourcePages(resourceId, pageStart, pageEnd, "ready");
    metrics.ragIndexingMs = Math.round(performance.now() - ragIndexingStartedAt);
    ocrAvailable = true;
    resourceRepository.updateProcessingJob(jobId, { stage: "analyzing", phase: "knowledge-analysis", metrics });
    const analyzingStartedAt = performance.now();
    const completeAnalysis = await analyzer.analyze(
      publicResource,
      chunks,
      resourceRepository.listNodes(),
    );
    metrics.analyzingMs = Math.round(performance.now() - analyzingStartedAt);
    resourceRepository.updateProcessingJob(jobId, { stage: "saving" });
    resourceRepository.replacePendingSuggestions(
      resourceId,
      completeAnalysis.suggestions,
      { start: pageStart, end: pageEnd },
    );
    resourceRepository.updateResource(resourceId, {
      status: normalizedDocument.warnings.length ? "needs-review" : "ready",
      summary: publicResource.summary || completeAnalysis.summary,
      tags: [...new Set([...publicResource.tags, ...completeAnalysis.tags])],
      parseErrorCode: undefined,
    });
    const completedAt = new Date().toISOString();
    metrics.totalMs = Math.round(performance.now() - processingStartedAt);
    resourceRepository.updateProcessingJob(jobId, { status: "completed", stage: "completed", phase: undefined, metrics, completedAt });
  } catch (error) {
    const code =
      error instanceof MaterialParserError
        ? error.code
        : error instanceof Error
          ? error.message
          : "RESOURCE_PROCESSING_FAILED";
    resourceRepository.updateResource(resourceId, {
      status: ocrAvailable ? "needs-review" : "failed",
      parseErrorCode: code,
    });
    if (!ocrAvailable) {
      resourceRepository.markResourcePages(resourceId, pageStart, pageEnd, "failed", code);
      resourceRepository.markResourcePagesRag(resourceId, pageStart, pageEnd, "failed", code);
    }
    metrics.totalMs = Math.round(performance.now() - processingStartedAt);
    resourceRepository.updateProcessingJob(jobId, { status: "failed", stage: "failed", phase: undefined, metrics, errorCode: code, completedAt: new Date().toISOString() });
    throw error;
  } finally {
    if (temporaryPath)
      await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
};
