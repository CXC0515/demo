/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DocumentParserConfig {
  paddleAccessToken: string;
  paddleBaseUrl?: string;
  paddleModel: string;
  paddleCommand: string;
  pythonCommand: string;
}

export const getDocumentParserConfig = (): DocumentParserConfig => ({
  paddleAccessToken: process.env.PADDLEOCR_ACCESS_TOKEN?.trim() ?? '',
  paddleBaseUrl: process.env.PADDLEOCR_BASE_URL?.trim() || undefined,
  paddleModel: process.env.PADDLEOCR_MODEL?.trim() || 'PaddleOCR-VL-1.6',
  paddleCommand: process.env.PADDLEOCR_COMMAND?.trim() || 'paddleocr',
  pythonCommand: process.env.PADDLEOCR_PYTHON?.trim() || 'python3'
});

export const isPaddleCloudConfigured = (config: DocumentParserConfig) => Boolean(config.paddleAccessToken);
