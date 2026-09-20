/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { rename, rm } from 'node:fs/promises';
import sharp from 'sharp';

export interface RecognitionEnhancementOptions {
  maxDimension?: number;
  jpegQuality?: number;
}

export const enhanceRecognitionPage = async (sourcePath: string, options: RecognitionEnhancementOptions = {}) => {
  const temporaryPath = `${sourcePath}.enhanced-${process.pid}`;

  try {
    const { format } = await sharp(sourcePath).metadata();
    const image = sharp(sourcePath)
      .resize({ width: options.maxDimension, height: options.maxDimension, fit: 'inside', withoutEnlargement: true })
      .greyscale()
      .linear(1.08, -8)
      .sharpen({ sigma: 0.4, m1: 0.3, m2: 0.7 });
    if (format === 'png') await image.png({ compressionLevel: 6 }).toFile(temporaryPath);
    else await image.jpeg({ quality: options.jpegQuality ?? 95 }).toFile(temporaryPath);
    await rename(temporaryPath, sourcePath);
    return format === 'png' ? 'image/png' as const : 'image/jpeg' as const;
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
};
