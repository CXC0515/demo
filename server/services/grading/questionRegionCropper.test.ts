/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { PaddleParserArtifact } from '../../schemas/paddleParserArtifact';
import { createVisionLocatedRegions, VisionLocatedRegion } from './questionRegionCropper';

const taskId = 'vision-cropper-test-task';
const assetId = 'vision-cropper-test-asset';
const sourceDirectory = path.resolve('var/data/test-artifacts');

const makePage = async (pageNumber: number) => {
  await mkdir(sourceDirectory, { recursive: true });
  const sourcePath = path.join(sourceDirectory, `${assetId}-${pageNumber}.jpg`);
  const ink = Buffer.from('<svg width="800" height="1000"><text x="180" y="320" font-size="36">student answer</text></svg>');
  await sharp({ create: { width: 800, height: 1000, channels: 3, background: 'white' } })
    .composite([{ input: ink }])
    .jpeg()
    .toFile(sourcePath);
  return { pageNumber, sourceImagePath: sourcePath };
};

const located = (overrides: Partial<VisionLocatedRegion> = {}): VisionLocatedRegion => ({
  displayNo: '1',
  pageNumber: 1,
  boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.25 },
  evidenceUnits: [{
    evidenceId: '1-answer',
    kind: 'text',
    boundingBox: { x: 0.2, y: 0.26, width: 0.45, height: 0.1 },
    provisionalText: 'student answer',
    confidence: 0.95,
    needsReview: false,
    reason: ''
  }],
  confidence: 0.95,
  needsReview: false,
  reason: '',
  ...overrides
});

test('creates question and answer evidence crops from page-level visual coordinates', async () => {
  const page = await makePage(1);
  try {
    const [region] = await createVisionLocatedRegions(
      taskId,
      assetId,
      [page],
      ['1'],
      new Map([['1', ['1-answer']]]),
      [located()]
    );
    assert.equal(region.locationStatus, 'located');
    assert.equal(region.region.pageNumber, 1);
    assert.equal(region.evidenceUnits.length, 1);
    assert.ok(region.evidenceUnits[0].region.x >= region.region.x);
    assert.ok(region.evidenceUnits[0].region.x + region.evidenceUnits[0].region.width <= region.region.x + region.region.width);
  } finally {
    await rm(page.sourceImagePath, { force: true });
    await rm(path.resolve('var/uploads/validation', taskId), { recursive: true, force: true });
  }
});

test('does not release a question when an expected answer unit is missing', async () => {
  const page = await makePage(1);
  try {
    const [region] = await createVisionLocatedRegions(
      taskId,
      assetId,
      [page],
      ['1'],
      new Map([['1', ['1-1', '1-2']]]),
      [located({ evidenceUnits: [{ ...located().evidenceUnits[0], evidenceId: '1-1' }] })]
    );
    assert.equal(region.locationStatus, 'needs-teacher');
    assert.match(region.locationReasons.join(' '), /1-2/);
  } finally {
    await rm(page.sourceImagePath, { force: true });
    await rm(path.resolve('var/uploads/validation', taskId), { recursive: true, force: true });
  }
});

test('uses the page returned by visual location for multi-page submissions', async () => {
  const firstPage = await makePage(1);
  const secondPage = await makePage(2);
  try {
    const [region] = await createVisionLocatedRegions(
      taskId,
      assetId,
      [firstPage, secondPage],
      ['1'],
      new Map([['1', ['1-answer']]]),
      [located({ pageNumber: 2 })]
    );
    assert.equal(region.region.pageNumber, 2);
    assert.equal(region.evidenceUnits[0].region.pageNumber, 2);
  } finally {
    await rm(firstPage.sourceImagePath, { force: true });
    await rm(secondPage.sourceImagePath, { force: true });
    await rm(path.resolve('var/uploads/validation', taskId), { recursive: true, force: true });
  }
});

test('recovers an unnumbered choice row only when neighboring question numbers establish its sequence', async () => {
  const page = await makePage(1);
  const artifact: PaddleParserArtifact = {
    model: 'PaddleOCR-VL-1.6',
    pages: [{
      pageNumber: 1,
      prunedResult: {
        width: 800,
        height: 1000,
        parsing_res_list: [
          { block_label: 'text', block_content: '3 [A] [B] [C] [D]', block_bbox: [60, 300, 300, 325], block_id: 1, block_order: 1 },
          { block_label: 'text', block_content: '[A] [B] [C] [D]', block_bbox: [60, 330, 300, 355], block_id: 2, block_order: 2 },
          { block_label: 'text', block_content: '5. 下一题', block_bbox: [60, 370, 400, 430], block_id: 3, block_order: 3 }
        ]
      }
    }]
  };
  try {
    const [region] = await createVisionLocatedRegions(
      taskId,
      assetId,
      [page],
      ['4'],
      new Map([['4', ['4-1']]]),
      [],
      artifact
    );
    assert.equal(region.locatorSource, 'paddle-layout');
    assert.equal(region.locationStatus, 'located');
    assert.ok(region.region.y >= 325 && region.region.y < 335, JSON.stringify(region.region));
    assert.ok(region.region.y + region.region.height <= 360);
  } finally {
    await rm(page.sourceImagePath, { force: true });
    await rm(path.resolve('var/uploads/validation', taskId), { recursive: true, force: true });
  }
});
