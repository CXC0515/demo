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

const makeChoicePage = async () => {
  await mkdir(sourceDirectory, { recursive: true });
  const sourcePath = path.join(sourceDirectory, `${assetId}-choices.jpg`);
  const ink = Buffer.from('<svg width="800" height="1000"><text x="70" y="320" font-size="24">3 [A] [B] [C] [D]</text><text x="70" y="350" font-size="24">4 [A] [B] [C] [D]</text></svg>');
  await sharp({ create: { width: 800, height: 1000, channels: 3, background: 'white' } })
    .composite([{ input: ink }])
    .jpeg()
    .toFile(sourcePath);
  return { pageNumber: 1, sourceImagePath: sourcePath };
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

test('splits a merged Paddle block using image rows instead of averaged coordinates', async () => {
  const page = await makeChoicePage();
  const artifact: PaddleParserArtifact = {
    model: 'PaddleOCR-VL-1.6',
    pages: [{
      pageNumber: 1,
      prunedResult: {
        width: 800,
        height: 1000,
        parsing_res_list: [
          { block_label: 'text', block_content: '3 [A] [B] [C] [D]\n4 [A] [B] [C] [D]', block_bbox: [60, 290, 350, 360], block_id: 1, block_order: 2 }
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
      [located({
        displayNo: '4',
        boundingBox: { x: 0.07, y: 0.55, width: 0.32, height: 0.03 },
        evidenceUnits: [{
          ...located().evidenceUnits[0],
          evidenceId: '4-1',
          kind: 'choice',
          boundingBox: { x: 0.07, y: 0.55, width: 0.32, height: 0.03 }
        }]
      })],
      artifact
    );
    assert.equal(region.locatorSource, 'vision-layout');
    assert.equal(region.locationStatus, 'located');
    assert.ok(region.region.y >= 325 && region.region.y < 345, JSON.stringify(region.region));
    assert.ok(region.region.y + region.region.height <= 365);
    assert.equal(region.paddleText, '4 [A] [B] [C] [D]');
    assert.equal(region.evidenceUnits[0].paddleText, '4 [A] [B] [C] [D]');
  } finally {
    await rm(page.sourceImagePath, { force: true });
    await rm(path.resolve('var/uploads/validation', taskId), { recursive: true, force: true });
  }
});

test('uses geometric Paddle blocks even when block_order is reversed', async () => {
  const page = await makePage(1);
  const artifact: PaddleParserArtifact = {
    model: 'PaddleOCR-VL-1.6',
    pages: [{
      pageNumber: 1,
      prunedResult: {
        width: 800,
        height: 1000,
        parsing_res_list: [
          { block_label: 'text', block_content: '4 [A] [B] [C] [D]', block_bbox: [60, 340, 300, 365], block_id: 2, block_order: 1 },
          { block_label: 'text', block_content: '3 [A] [B] [C] [D]', block_bbox: [60, 300, 300, 325], block_id: 1, block_order: 2 }
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
      [located({
        displayNo: '4',
        boundingBox: { x: 0.07, y: 0.33, width: 0.32, height: 0.05 },
        evidenceUnits: [{ ...located().evidenceUnits[0], evidenceId: '4-1', kind: 'choice' }]
      })],
      artifact
    );
    assert.ok(region.region.y >= 335 && region.region.y < 345, JSON.stringify(region.region));
    assert.ok(region.region.y + region.region.height <= 370);
  } finally {
    await rm(page.sourceImagePath, { force: true });
    await rm(path.resolve('var/uploads/validation', taskId), { recursive: true, force: true });
  }
});

test('keeps continuation blocks in the same column when other columns interleave', async () => {
  const page = await makePage(1);
  const artifact: PaddleParserArtifact = {
    model: 'PaddleOCR-VL-1.6',
    pages: [{
      pageNumber: 1,
      prunedResult: {
        width: 800,
        height: 1000,
        parsing_res_list: [
          { block_label: 'text', block_content: '5. ① 活动名称', block_bbox: [60, 700, 260, 725], block_id: 1, block_order: 1 },
          { block_label: 'text', block_content: '13 [A] [B] [C] [D]', block_bbox: [410, 715, 650, 740], block_id: 2, block_order: 2 },
          { block_label: 'text', block_content: '② 活动说明', block_bbox: [60, 735, 330, 765], block_id: 3, block_order: 3 },
          { block_label: 'text', block_content: '7. 下一题', block_bbox: [60, 850, 330, 880], block_id: 4, block_order: 4 }
        ]
      }
    }]
  };
  const visual = located({
    displayNo: '5',
    boundingBox: { x: 0.05, y: 0.68, width: 0.9, height: 0.15 },
    evidenceUnits: [
      { ...located().evidenceUnits[0], evidenceId: '5-1', boundingBox: { x: 0.08, y: 0.7, width: 0.3, height: 0.04 } },
      { ...located().evidenceUnits[0], evidenceId: '5-2', boundingBox: { x: 0.08, y: 0.74, width: 0.4, height: 0.05 } }
    ]
  });
  try {
    const [region] = await createVisionLocatedRegions(
      taskId,
      assetId,
      [page],
      ['5'],
      new Map([['5', ['5-1', '5-2']]]),
      [visual],
      artifact
    );
    assert.ok(region.region.x + region.region.width < 380, JSON.stringify(region.region));
    assert.ok(region.region.y <= 700 && region.region.y + region.region.height >= 765);
    assert.equal(region.paddleText, '5. ① 活动名称\n② 活动说明');
  } finally {
    await rm(page.sourceImagePath, { force: true });
    await rm(path.resolve('var/uploads/validation', taskId), { recursive: true, force: true });
  }
});

test('keeps adjacent-question text out when the visual crop overlaps it', async () => {
  const page = await makePage(1);
  const artifact: PaddleParserArtifact = {
    model: 'PaddleOCR-VL-1.6',
    pages: [{
      pageNumber: 1,
      prunedResult: {
        width: 800,
        height: 1000,
        parsing_res_list: [
          { block_label: 'text', block_content: '1. ① 本题答案\n2. 下一题答案', block_bbox: [80, 300, 300, 370], block_id: 1, block_order: 1 }
        ]
      }
    }]
  };
  try {
    const [region] = await createVisionLocatedRegions(
      taskId,
      assetId,
      [page],
      ['1'],
      new Map([['1', ['1①-1']]]),
      [located({
        boundingBox: { x: 0.08, y: 0.28, width: 0.4, height: 0.12 },
        evidenceUnits: [{
          ...located().evidenceUnits[0],
          evidenceId: '1①-1',
          boundingBox: { x: 0.1, y: 0.3, width: 0.28, height: 0.04 }
        }]
      })],
      artifact
    );
    assert.equal(region.paddleText, '1. ① 本题答案');
  } finally {
    await rm(page.sourceImagePath, { force: true });
    await rm(path.resolve('var/uploads/validation', taskId), { recursive: true, force: true });
  }
});

test('uses the overlapping answer block when Paddle omits the printed question number', async () => {
  const page = await makePage(1);
  const artifact: PaddleParserArtifact = {
    model: 'PaddleOCR-VL-1.6',
    pages: [{
      pageNumber: 1,
      prunedResult: {
        width: 800,
        height: 1000,
        parsing_res_list: [
          { block_label: 'text', block_content: '我准备为杨利伟画像。', block_bbox: [160, 260, 520, 360], block_id: 1, block_order: 1 },
          { block_label: 'text', block_content: '7 [A] [B] [C] [D]', block_bbox: [160, 380, 360, 410], block_id: 2, block_order: 2 }
        ]
      }
    }]
  };
  try {
    const [region] = await createVisionLocatedRegions(
      taskId,
      assetId,
      [page],
      ['6'],
      new Map([['6', ['6-answer']]]),
      [located({
        displayNo: '6',
        boundingBox: { x: 0.18, y: 0.24, width: 0.5, height: 0.14 },
        evidenceUnits: [{
          ...located().evidenceUnits[0],
          evidenceId: '6-answer',
          boundingBox: { x: 0.2, y: 0.26, width: 0.45, height: 0.1 }
        }]
      })],
      artifact
    );
    assert.equal(region.paddleText, '我准备为杨利伟画像。');
  } finally {
    await rm(page.sourceImagePath, { force: true });
    await rm(path.resolve('var/uploads/validation', taskId), { recursive: true, force: true });
  }
});
