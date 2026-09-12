/** @license SPDX-License-Identifier: Apache-2.0 */
import path from 'node:path';
import { uploadFilePath } from '../../context/workspaceContext';

export const sourcePageImagePath = (assetId: string, pageNumber: number, fileName?: string) =>
  uploadFilePath('parsed', assetId, 'page-images', path.basename(fileName || `page-${pageNumber}.jpg`));
