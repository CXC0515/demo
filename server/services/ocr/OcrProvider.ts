/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OcrRegion {
  pageNumber: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  text: string;
  confidence: number;
}

export interface OcrDocumentResult {
  pageCount: number;
  regions: OcrRegion[];
}

export interface OcrProvider {
  parseDocument(filePath: string): Promise<OcrDocumentResult>;
}
