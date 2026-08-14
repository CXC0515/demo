/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { rename, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const enhanceRecognitionPage = async (sourcePath: string) => {
  const extension = path.extname(sourcePath).toLowerCase();
  const temporaryPath = `${sourcePath}.enhanced-${process.pid}`;
  const image = sharp(sourcePath)
    .greyscale()
    .linear(1.08, -8)
    .sharpen({ sigma: 0.4, m1: 0.3, m2: 0.7 });

  try {
    if (extension === '.png') await image.png({ compressionLevel: 6 }).toFile(temporaryPath);
    else await image.jpeg({ quality: 95 }).toFile(temporaryPath);
    await rename(temporaryPath, sourcePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
};
