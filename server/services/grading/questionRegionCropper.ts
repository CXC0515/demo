/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { VisionEvidenceKind } from '../../../src/domain/types';
import { PaddleParserArtifact } from '../../schemas/paddleParserArtifact';
import { containsRegion, expandRegion, inspectCropEdges, PixelRegion } from './answerEvidenceValidator';

export interface PageSource {
  pageNumber: number;
  sourceImagePath: string;
}

export interface VisionLocatedEvidence {
  evidenceId: string;
  kind: VisionEvidenceKind;
  boundingBox: { x: number; y: number; width: number; height: number };
  provisionalText: string;
  confidence: number;
  needsReview: boolean;
  reason: string;
}

export interface VisionLocatedRegion {
  displayNo: string;
  pageNumber: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  evidenceUnits: VisionLocatedEvidence[];
  confidence: number;
  needsReview: boolean;
  reason: string;
}

export interface LocatedEvidence {
  evidenceId: string;
  kind: VisionEvidenceKind;
  region: PixelRegion & { pageNumber: number };
  cropPath: string;
  cropUrl: string;
  provisionalText: string;
  confidence: number;
  needsReview: boolean;
  reviewReasons: string[];
}

export interface LocatedRegion {
  displayNo: string;
  region: PixelRegion & { pageNumber: number };
  locatorSource: 'vision-layout' | 'paddle-layout';
  locationStatus: 'located' | 'needs-teacher';
  locationReasons: string[];
  paddleText: string;
  cropPath: string;
  cropUrl: string;
  evidenceUnits: LocatedEvidence[];
}

const toPixels = (
  box: { x: number; y: number; width: number; height: number },
  width: number,
  height: number
): PixelRegion => {
  const x = Math.max(0, Math.min(width - 1, Math.floor(box.x * width)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(box.y * height)));
  const right = Math.max(x + 1, Math.min(width, Math.ceil((box.x + box.width) * width)));
  const bottom = Math.max(y + 1, Math.min(height, Math.ceil((box.y + box.height) * height)));
  return { x, y, width: right - x, height: bottom - y };
};

const writeCrop = async (sourcePath: string, targetPath: string, region: PixelRegion) => {
  await sharp(sourcePath)
    .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
    .resize({ width: region.width * 3, height: region.height * 3, kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 95 })
    .toFile(targetPath);
};

interface PaddleRow {
  key: string;
  region: PixelRegion;
  inferred?: boolean;
}

const circledNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

const answerRowFromPaddle = (
  artifact: PaddleParserArtifact,
  pageNumber: number,
  displayNo: string,
  evidenceId: string,
  kind: VisionEvidenceKind,
  visualQuestion: PixelRegion
): PaddleRow | undefined => {
  const page = artifact.pages.find(candidate => candidate.pageNumber === pageNumber);
  if (!page) return undefined;
  const orderedBlocks = [...page.prunedResult.parsing_res_list]
    .filter(block => block.block_order !== null && block.block_order !== undefined)
    .sort((first, second) => (first.block_order ?? 0) - (second.block_order ?? 0));
  const rowFor = (block: (typeof orderedBlocks)[number], blockIndex: number, lineIndex: number, lines: string[]): PaddleRow => {
    const [left, top, right, bottom] = block.block_bbox;
    const lineHeight = (bottom - top) / lines.length;
    return {
      key: `${blockIndex}:${lineIndex}`,
      region: {
        x: left,
        y: Math.floor(top + lineHeight * lineIndex),
        width: Math.max(1, right - left),
        height: Math.max(1, Math.ceil(lineHeight))
      }
    };
  };
  if (kind === 'choice') {
    const choices: PaddleRow[] = [];
    const layoutRows: Array<PaddleRow & { number?: string; hasOptions: boolean }> = [];
    for (const [blockIndex, block] of orderedBlocks.entries()) {
      const lines = block.block_content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      lines.forEach((line, lineIndex) => layoutRows.push({
        ...rowFor(block, blockIndex, lineIndex, lines),
        number: line.match(/^(\d+)(?:\s|[.、\[])/)?.[1],
        hasOptions: (line.match(/\[[A-Z]\]/gi)?.length ?? 0) >= 2
      }));
      const lineIndex = lines.findIndex(line => line.match(/^(\d+)(?:\s|[.、\[])/)?.[1] === displayNo && /\[[A-Z]\]/i.test(line));
      if (lineIndex >= 0) choices.push(rowFor(block, blockIndex, lineIndex, lines));
    }
    const nearest = choices.sort((first, second) => {
      const center = (region: PixelRegion) => region.y + region.height / 2;
      return Math.abs(center(first.region) - center(visualQuestion)) - Math.abs(center(second.region) - center(visualQuestion));
    })[0];
    if (nearest) return nearest;
    const inferred = layoutRows.find((row, index) => {
      if (!row.hasOptions || row.number) return false;
      const previousNumber = [...layoutRows.slice(0, index)].reverse().find(candidate => candidate.number)?.number;
      const nextNumber = layoutRows.slice(index + 1).find(candidate => candidate.number)?.number;
      return Number(previousNumber) === Number(displayNo) - 1 && Number(nextNumber) === Number(displayNo) + 1;
    });
    if (inferred) return { ...inferred, inferred: true };
  }
  const startIndex = orderedBlocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.block_content.split(/\r?\n/).some(line => line.trim().match(/^(\d+)(?:\s|[.、])/i)?.[1] === displayNo))
    .sort((first, second) => {
      const distance = ({ block }: typeof first) => {
        const [left, top, right, bottom] = block.block_bbox;
        const region = { x: left, y: top, width: right - left, height: bottom - top };
        return -overlapRatio(region, visualQuestion) * 10_000 + Math.abs((top + bottom) / 2 - (visualQuestion.y + visualQuestion.height / 2));
      };
      return distance(first) - distance(second);
    })[0]?.index ?? -1;
  if (startIndex < 0) return undefined;
  let endIndex = startIndex + 1;
  while (endIndex < orderedBlocks.length) {
    const nextNumber = orderedBlocks[endIndex].block_content.trim().match(/^(\d+)(?:\s|[.、])/i)?.[1];
    if (nextNumber && nextNumber !== displayNo) break;
    endIndex += 1;
  }
  const embeddedMarker = evidenceId.match(/[①②③④⑤⑥⑦⑧⑨⑩]/)?.[0];
  const fieldIndex = Number(evidenceId.match(/-(\d+)$/)?.[1] ?? 0);
  const marker = embeddedMarker ?? circledNumbers[fieldIndex - 1];
  if (!marker) return undefined;
  for (let blockIndex = startIndex; blockIndex < endIndex; blockIndex += 1) {
    const block = orderedBlocks[blockIndex];
    const lines = block.block_content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const lineIndex = lines.findIndex(line => line.includes(marker));
    if (lineIndex >= 0) return rowFor(block, blockIndex, lineIndex, lines);
  }
  return undefined;
};

const unionRegions = (regions: PixelRegion[]): PixelRegion => {
  const left = Math.min(...regions.map(region => region.x));
  const top = Math.min(...regions.map(region => region.y));
  const right = Math.max(...regions.map(region => region.x + region.width));
  const bottom = Math.max(...regions.map(region => region.y + region.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const overlapRatio = (first: PixelRegion, second: PixelRegion) => {
  const width = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const height = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  return (width * height) / Math.max(1, Math.min(first.width * first.height, second.width * second.height));
};

const emptyPanelFromPaddle = (
  artifact: PaddleParserArtifact,
  pageNumber: number,
  visualQuestion: PixelRegion
): PixelRegion | undefined => {
  const page = artifact.pages.find(candidate => candidate.pageNumber === pageNumber);
  return page?.prunedResult.parsing_res_list
    .filter(block => !block.block_content.trim())
    .map(block => {
      const [left, top, right, bottom] = block.block_bbox;
      return { x: left, y: top, width: right - left, height: bottom - top };
    })
    .filter(region => region.width * region.height > 5_000 && overlapRatio(region, visualQuestion) > 0.25)
    .sort((first, second) => overlapRatio(second, visualQuestion) - overlapRatio(first, visualQuestion))[0];
};

const padRegion = (region: PixelRegion, limit: PixelRegion, xPadding = 12, yPadding = 8): PixelRegion => {
  const limitRight = limit.x + limit.width;
  const limitBottom = limit.y + limit.height;
  const left = Math.min(limitRight - 1, Math.max(limit.x, region.x - xPadding));
  const top = Math.min(limitBottom - 1, Math.max(limit.y, region.y - yPadding));
  const right = Math.max(left + 1, Math.min(limitRight, region.x + region.width + xPadding));
  const bottom = Math.max(top + 1, Math.min(limitBottom, region.y + region.height + yPadding));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const snapInferredRowToInk = async (sourcePath: string, row: PixelRegion): Promise<PixelRegion> => {
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height) return row;
  const search = padRegion(row, { x: 0, y: 0, width: metadata.width, height: metadata.height }, 8, row.height);
  const { data, info } = await sharp(sourcePath)
    .extract({ left: search.x, top: search.y, width: search.width, height: search.height })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const activeRows: number[] = [];
  for (let y = 0; y < info.height; y += 1) {
    let dark = 0;
    for (let x = 0; x < info.width; x += 1) if (data[y * info.width + x] < 165) dark += 1;
    if (dark >= Math.max(4, info.width * 0.025) && dark < info.width * 0.65) activeRows.push(y);
  }
  const bands = activeRows.reduce<Array<{ top: number; bottom: number }>>((result, y) => {
    const current = result[result.length - 1];
    if (!current || y - current.bottom > 2) result.push({ top: y, bottom: y });
    else current.bottom = y;
    return result;
  }, []).filter(band => band.bottom - band.top >= 2);
  const originalCenter = row.y + row.height / 2;
  const target = bands.find(band => search.y + (band.top + band.bottom) / 2 >= originalCenter);
  if (!target) return row;
  const top = Math.max(0, search.y + target.top - 2);
  const bottom = Math.min(metadata.height, search.y + target.bottom + 3);
  return { x: row.x, y: top, width: row.width, height: Math.max(1, bottom - top) };
};

export const createVisionLocatedRegions = async (
  taskId: string,
  assetId: string,
  pageSources: PageSource[],
  requestedQuestionNos: string[],
  expectedEvidenceIds: Map<string, string[]>,
  visionRegions: VisionLocatedRegion[],
  artifact?: PaddleParserArtifact
): Promise<LocatedRegion[]> => {
  const cropDirectory = path.resolve('var/uploads/validation', taskId, assetId);
  await mkdir(cropDirectory, { recursive: true });
  const pageByNumber = new Map(pageSources.map(page => [page.pageNumber, page]));
  const bestRegionByNo = new Map<string, VisionLocatedRegion>();
  for (const region of visionRegions) {
    const current = bestRegionByNo.get(region.displayNo);
    if (!current || region.confidence > current.confidence) bestRegionByNo.set(region.displayNo, region);
  }

  return Promise.all(requestedQuestionNos.map(async displayNo => {
    const vision = bestRegionByNo.get(displayNo);
    const page = vision ? pageByNumber.get(vision.pageNumber) : pageSources[0];
    if (!page) throw new Error('SOURCE_PAGE_NOT_FOUND');
    const metadata = await sharp(page.sourceImagePath).metadata();
    if (!metadata.width || !metadata.height) throw new Error('SOURCE_PAGE_INVALID');
    const fullPage = { x: 0, y: 0, width: metadata.width, height: metadata.height };
    const visualQuestion = vision ? toPixels(vision.boundingBox, metadata.width, metadata.height) : fullPage;
    const expectedIds = expectedEvidenceIds.get(displayNo) ?? [];
    const fallbackChoiceRow = !vision && artifact && expectedIds.length === 1
      ? answerRowFromPaddle(artifact, page.pageNumber, displayNo, expectedIds[0], 'choice', visualQuestion)
      : undefined;
    const answerPanel = vision && artifact && vision.evidenceUnits.length === 1 && vision.evidenceUnits[0].evidenceId.endsWith('-answer')
      ? emptyPanelFromPaddle(artifact, page.pageNumber, visualQuestion)
      : undefined;
    const sourceEvidence = vision?.evidenceUnits ?? (fallbackChoiceRow ? [{
      evidenceId: expectedIds[0],
      kind: 'choice' as const,
      boundingBox: { x: 0, y: 0, width: 1, height: 1 },
      provisionalText: '',
      confidence: 0,
      needsReview: true,
      reason: '整页视觉定位漏项，已用 Paddle 选项行恢复证据'
    }] : []);
    const evidencePlans = await Promise.all(sourceEvidence.map(async evidence => {
      const locatedRow = fallbackChoiceRow ?? (artifact ? answerRowFromPaddle(artifact, page.pageNumber, displayNo, evidence.evidenceId, evidence.kind, visualQuestion) : undefined);
      const paddleRow = locatedRow?.inferred
        ? { ...locatedRow, region: await snapInferredRowToInk(page.sourceImagePath, locatedRow.region) }
        : locatedRow;
      return {
        evidence,
        visualRegion: toPixels(evidence.boundingBox, metadata.width!, metadata.height!),
        paddleRow
      };
    }));
    const paddleRows = evidencePlans.flatMap(plan => plan.paddleRow ? [plan.paddleRow.region] : []);
    const questionPixels = paddleRows.length === evidencePlans.length && paddleRows.length
      ? unionRegions(paddleRows)
      : answerPanel ?? visualQuestion;
    const questionRegion = padRegion(
      questionPixels,
      fullPage,
      12,
      sourceEvidence.length && sourceEvidence.every(unit => unit.kind === 'choice') ? 2 : 8
    );
    const questionFileName = `question-${displayNo}.jpg`;
    const questionPath = path.join(cropDirectory, questionFileName);
    await writeCrop(page.sourceImagePath, questionPath, questionRegion);

    const rowUseCount = new Map<string, number>();
    for (const plan of evidencePlans) if (plan.paddleRow) rowUseCount.set(plan.paddleRow.key, (rowUseCount.get(plan.paddleRow.key) ?? 0) + 1);
    const evidenceUnits = await Promise.all(evidencePlans.map(async ({ evidence, visualRegion, paddleRow }, evidenceIndex) => {
      const rawRegion = answerPanel && evidence.evidenceId.endsWith('-answer')
        ? answerPanel
        : paddleRow
        ? rowUseCount.get(paddleRow.key) === 1
          ? paddleRow.region
          : { ...visualRegion, y: paddleRow.region.y, height: paddleRow.region.height }
        : visualRegion;
      const isInsideQuestion = containsRegion(questionPixels, rawRegion);
      const boundedRegion = paddleRow
        ? padRegion(rawRegion, questionRegion, 12, 2)
        : expandRegion(rawRegion, questionRegion, metadata.width!, metadata.height!);
      const safeId = `${evidenceIndex + 1}-${Buffer.from(evidence.evidenceId).toString('hex').slice(0, 20)}`;
      const fileName = `question-${displayNo}-evidence-${safeId}.jpg`;
      const cropPath = path.join(cropDirectory, fileName);
      await writeCrop(page.sourceImagePath, cropPath, boundedRegion);
      const edgeInspection = await inspectCropEdges(cropPath);
      const reviewReasons = [
        ...(evidence.needsReview && evidence.reason ? [evidence.reason] : []),
        ...(!isInsideQuestion ? ['答案证据超出题目区域'] : []),
        ...(!edgeInspection.hasContent ? ['答案证据中未检测到有效笔迹'] : []),
        ...(edgeInspection.touchesEdge ? ['笔迹接近证据图边缘，可能截断'] : [])
      ];
      return {
        evidenceId: evidence.evidenceId,
        kind: evidence.kind,
        region: { ...boundedRegion, pageNumber: page.pageNumber },
        cropPath,
        cropUrl: `/uploads/validation/${encodeURIComponent(taskId)}/${encodeURIComponent(assetId)}/${encodeURIComponent(fileName)}`,
        provisionalText: evidence.provisionalText,
        confidence: evidence.confidence,
        needsReview: evidence.needsReview || reviewReasons.length > 0,
        reviewReasons
      };
    }));
    const returnedIds = new Set(evidenceUnits.map(unit => unit.evidenceId));
    const missingIds = (expectedEvidenceIds.get(displayNo) ?? []).filter(id => !returnedIds.has(id));
    const locationReasons = [
      ...(!vision && !fallbackChoiceRow ? ['整页视觉定位未返回该题'] : []),
      ...(vision?.needsReview ? [vision.reason || '整页视觉定位需要核验'] : []),
      ...(missingIds.length ? [`缺少答案证据：${missingIds.join('、')}`] : [])
    ];
    return {
      displayNo,
      region: { ...questionRegion, pageNumber: page.pageNumber },
      locatorSource: fallbackChoiceRow ? 'paddle-layout' : 'vision-layout',
      locationStatus: locationReasons.length ? 'needs-teacher' : 'located',
      locationReasons,
      paddleText: '',
      cropPath: questionPath,
      cropUrl: `/uploads/validation/${encodeURIComponent(taskId)}/${encodeURIComponent(assetId)}/${encodeURIComponent(questionFileName)}`,
      evidenceUnits
    };
  }));
};
