/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { access } from "node:fs/promises";
import path from "node:path";
import { uploadFilePath } from "../../context/workspaceContext";
import { resourceRepository } from "../../repositories/resourceRepository";

export const getResourcePageImagePath = async (resourceId: string, pageNumber: number) => {
  const resource = resourceRepository.getStoredResource(resourceId);
  if (!resource) throw new Error("RESOURCE_NOT_FOUND");
  if (!resource.pageCount || pageNumber < 1 || pageNumber > resource.pageCount) throw new Error("INVALID_PAGE_NUMBER");
  const previewDirectory = uploadFilePath("parsed", resourceId, "page-images");
  const outputPath = path.join(previewDirectory, `page-${pageNumber}.jpg`);
  try {
    await access(outputPath);
    return outputPath;
  } catch {
    throw new Error("RESOURCE_PAGE_IMAGE_NOT_FOUND");
  }
};
