/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { resourceRepository } from "../../repositories/resourceRepository";

const execFileAsync = promisify(execFile);

export const getResourcePageImagePath = async (resourceId: string, pageNumber: number) => {
  const resource = resourceRepository.getStoredResource(resourceId);
  if (!resource) throw new Error("RESOURCE_NOT_FOUND");
  if (!resource.pageCount || pageNumber < 1 || pageNumber > resource.pageCount) throw new Error("INVALID_PAGE_NUMBER");
  const previewDirectory = path.resolve("var/uploads/parsed", resourceId, "page-images");
  const outputBase = path.join(previewDirectory, `page-${pageNumber}`);
  const outputPath = `${outputBase}.jpg`;
  try {
    await access(outputPath);
    return outputPath;
  } catch {
    await mkdir(previewDirectory, { recursive: true });
    await execFileAsync(process.env.PDFTOPPM_COMMAND || "pdftoppm", [
      "-f", String(pageNumber), "-l", String(pageNumber), "-singlefile",
      "-jpeg", "-r", "120", resource.diskPath, outputBase,
    ], { timeout: 120_000, maxBuffer: 1024 * 1024 });
    return outputPath;
  }
};
