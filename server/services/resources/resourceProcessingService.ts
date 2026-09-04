/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
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
  try {
    resourceRepository.updateProcessingJob(jobId, { stage: "preparing" });
    temporaryPath = await createPageRangePdf(
      resource.diskPath,
      resourceId,
      pageStart,
      pageEnd,
    );
    resourceRepository.updateProcessingJob(jobId, { stage: "ocr" });
    const normalizedDocument = await parseMaterial({
      assetId: resource.id,
      fileName: resource.fileName,
      mimeType: resource.mimeType,
      filePath: temporaryPath,
    });
    const publicResource = resourceRepository.getStoredResource(resourceId)!;
    const chunks = buildResourceChunks(
      publicResource,
      normalizedDocument,
      pageStart - 1,
    );
    const analyzer = new ResourceAnalyzer(getModelConfig());
    resourceRepository.updateProcessingJob(jobId, { stage: "saving" });
    resourceRepository.mergeChunksForPages(resourceId, pageStart, pageEnd, chunks);
    const allChunks = resourceRepository.listChunks(resourceId);
    resourceRepository.updateProcessingJob(jobId, { stage: "analyzing" });
    const completeAnalysis = await analyzer.analyze(
      publicResource,
      allChunks,
      resourceRepository.listNodes(),
    );
    resourceRepository.updateProcessingJob(jobId, { stage: "saving" });
    resourceRepository.replacePendingSuggestions(
      resourceId,
      completeAnalysis.suggestions,
    );
    resourceRepository.markResourcePages(resourceId, pageStart, pageEnd, "ready");
    resourceRepository.updateResource(resourceId, {
      status: normalizedDocument.warnings.length ? "needs-review" : "ready",
      summary: completeAnalysis.summary,
      tags: completeAnalysis.tags,
      parseErrorCode: undefined,
    });
    const completedAt = new Date().toISOString();
    resourceRepository.updateProcessingJob(jobId, { status: "completed", stage: "completed", completedAt });
  } catch (error) {
    const code =
      error instanceof MaterialParserError
        ? error.code
        : error instanceof Error
          ? error.message
          : "RESOURCE_PROCESSING_FAILED";
    resourceRepository.updateResource(resourceId, {
      status: "failed",
      parseErrorCode: code,
    });
    resourceRepository.markResourcePages(resourceId, pageStart, pageEnd, "failed", code);
    resourceRepository.updateProcessingJob(jobId, { status: "failed", stage: "failed", errorCode: code, completedAt: new Date().toISOString() });
    throw error;
  } finally {
    if (temporaryPath)
      await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
};
