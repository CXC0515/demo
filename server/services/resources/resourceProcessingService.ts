/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, rm, writeFile } from "node:fs/promises";
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

export const processLibraryResource = async (
  resourceId: string,
  pageStart: number,
  pageEnd: number,
) => {
  const resource = resourceRepository.getStoredResource(resourceId);
  if (!resource) throw new Error("RESOURCE_NOT_FOUND");
  if (resource.status === "processing")
    throw new Error("RESOURCE_ALREADY_PROCESSING");
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
  resourceRepository.updateResource(resourceId, {
    status: "processing",
    parseErrorCode: undefined,
    parsedPageStart: pageStart,
    parsedPageEnd: pageEnd,
  });
  let temporaryPath = "";
  try {
    temporaryPath = await createPageRangePdf(
      resource.diskPath,
      resourceId,
      pageStart,
      pageEnd,
    );
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
    const analysis = await analyzer.analyze(
      publicResource,
      chunks,
      resourceRepository.listNodes(),
    );
    const root = chunks.find((chunk) => chunk.level === "document");
    if (root) {
      root.summary = analysis.summary;
      root.tags = analysis.tags;
    }
    resourceRepository.replaceChunks(resourceId, chunks);
    resourceRepository.replacePendingSuggestions(
      resourceId,
      analysis.suggestions,
    );
    resourceRepository.updateResource(resourceId, {
      status: normalizedDocument.warnings.length ? "needs-review" : "ready",
      summary: analysis.summary,
      tags: analysis.tags,
      parseErrorCode: undefined,
    });
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
    throw error;
  } finally {
    if (temporaryPath)
      await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
};
