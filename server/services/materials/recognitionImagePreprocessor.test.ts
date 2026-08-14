/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { enhanceRecognitionPage } from './recognitionImagePreprocessor';

test('enhances a low-contrast page without changing its coordinate space', async () => {
  const filePath = path.join(os.tmpdir(), `recognition-page-${process.pid}.jpg`);
  const width = 160;
  const height = 100;
  const pixels = Buffer.alloc(width * height * 3, 205);
  for (let y = 35; y < 65; y += 1) {
    for (let x = 25; x < 135; x += 1) {
      const index = (y * width + x) * 3;
      pixels[index] = 175;
      pixels[index + 1] = 175;
      pixels[index + 2] = 175;
    }
  }
  try {
    await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 100 }).toFile(filePath);
    const before = await sharp(filePath).greyscale().raw().toBuffer();
    await enhanceRecognitionPage(filePath);
    const image = sharp(filePath);
    const metadata = await image.metadata();
    const after = await image.greyscale().raw().toBuffer();
    const range = (values: Buffer) => Math.max(...values) - Math.min(...values);
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert.ok(range(after) > range(before), `${range(after)} <= ${range(before)}`);
  } finally {
    await rm(filePath, { force: true });
  }
});
