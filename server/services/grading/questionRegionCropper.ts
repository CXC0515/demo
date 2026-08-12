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
  paddleText: string;
  paddleTextShared: boolean;
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
    .jpeg({ quality: 95 })
    .toFile(targetPath);
};

const writeRecognitionCrop = async (sourcePath: string, targetPath: string, region: PixelRegion) => {
  await sharp(sourcePath)
    .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
    .greyscale()
    .normalize()
    .sharpen({ sigma: 0.8 })
    .jpeg({ quality: 95 })
    .toFile(targetPath);
};

interface PaddleRow {
  key: string;
  textKey: string;
  region: PixelRegion;
  text: string;
  lineIndex?: number;
  lineCount?: number;
}

const circledNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const choiceLinePattern = (displayNo: string) => new RegExp(`^${displayNo}(?:\\s|[.、\\[])`);
const hasChoiceStructure = (line: string) => /\[[A-Z]\]|(?:^|\s)[A-D][.、)]/i.test(line);

const choiceRowAcrossPages = (artifact: PaddleParserArtifact, displayNo: string) => {
  for (const page of [...artifact.pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    const blocks = [...page.prunedResult.parsing_res_list].sort((a, b) => a.block_bbox[1] - b.block_bbox[1] || a.block_bbox[0] - b.block_bbox[0]);
    for (const [blockIndex, block] of blocks.entries()) {
      const lines = block.block_content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      let lineIndex = lines.findIndex(line => choiceLinePattern(displayNo).test(line) && hasChoiceStructure(line));
      if (lineIndex < 0) {
        const nextNumber = String(Number(displayNo) + 1);
        const nextIndex = lines.findIndex(line => choiceLinePattern(nextNumber).test(line) && hasChoiceStructure(line));
        if (nextIndex > 0 && hasChoiceStructure(lines[nextIndex - 1])) lineIndex = nextIndex - 1;
      }
      if (lineIndex < 0) continue;
      const [left, top, right, bottom] = block.block_bbox;
      return {
        pageNumber: page.pageNumber,
        row: {
          key: `${blockIndex}:${lineIndex}`,
          textKey: `${blockIndex}:${lineIndex}`,
          region: { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) },
          text: lines[lineIndex],
          lineIndex,
          lineCount: lines.length
        } satisfies PaddleRow
      };
    }
  }
  return undefined;
};

const extractPaddleFieldText = (line: string, marker: string) => {
  const start = line.indexOf(marker);
  if (start < 0) return line.trim();
  const afterMarker = line.slice(start + marker.length);
  const nextMarkerIndex = circledNumbers
    .map(candidate => afterMarker.indexOf(candidate))
    .filter(index => index >= 0)
    .sort((first, second) => first - second)[0];
  const fieldText = nextMarkerIndex === undefined ? afterMarker : afterMarker.slice(0, nextMarkerIndex);
  return fieldText
    .replace(/\\(?:underline|text)/g, ' ')
    .replace(/[${}]/g, ' ')
    .replace(/^\s*[.、:：-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
};

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
    .sort((first, second) => first.block_bbox[1] - second.block_bbox[1] || first.block_bbox[0] - second.block_bbox[0]);
  const blockRegion = (
    block: (typeof orderedBlocks)[number],
    blockIndex: number,
    lineIndex?: number,
    lineCount?: number,
    lineText?: string,
    textKey?: string
  ): PaddleRow => {
    const [left, top, right, bottom] = block.block_bbox;
    return {
      key: lineIndex === undefined ? `${blockIndex}` : `${blockIndex}:${lineIndex}`,
      textKey: textKey ?? (lineIndex === undefined ? `${blockIndex}` : `${blockIndex}:${lineIndex}`),
      region: {
        x: left,
        y: top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top)
      },
      text: (lineText ?? block.block_content).trim(),
      lineIndex,
      lineCount
    };
  };
  if (kind === 'choice') {
    const choices: PaddleRow[] = [];
    for (const [blockIndex, block] of orderedBlocks.entries()) {
      const lines = block.block_content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const lineIndex = lines.findIndex(line => line.match(/^(\d+)(?:\s|[.、\[])/)?.[1] === displayNo && /\[[A-Z]\]/i.test(line));
      if (lineIndex >= 0) choices.push(blockRegion(block, blockIndex, lineIndex, lines.length, lines[lineIndex]));
    }
    const nearest = choices.sort((first, second) => {
      const center = (region: PixelRegion) => region.y + region.height / 2;
      return Math.abs(center(first.region) - center(visualQuestion)) - Math.abs(center(second.region) - center(visualQuestion));
    })[0];
    if (nearest) return nearest;
  }
  const start = orderedBlocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.block_content.split(/\r?\n/).some(line => line.trim().match(/^(\d+)(?:\s|[.、])/i)?.[1] === displayNo))
    .sort((first, second) => {
      const distance = ({ block }: typeof first) => {
        const [left, top, right, bottom] = block.block_bbox;
        const region = { x: left, y: top, width: right - left, height: bottom - top };
        return -overlapRatio(region, visualQuestion) * 10_000 + Math.abs((top + bottom) / 2 - (visualQuestion.y + visualQuestion.height / 2));
      };
      return distance(first) - distance(second);
    })[0];
  if (!start) return undefined;
  const [startLeft, startTop, startRight] = start.block.block_bbox;
  const startWidth = Math.max(1, startRight - startLeft);
  const sameLane = (block: (typeof orderedBlocks)[number]) => {
    const [left, , right] = block.block_bbox;
    const overlap = Math.max(0, Math.min(startRight, right) - Math.max(startLeft, left));
    const overlapRatio = overlap / Math.max(1, Math.min(startWidth, right - left));
    return overlapRatio >= 0.25 || Math.abs(left - startLeft) <= page.prunedResult.width * 0.04;
  };
  const nextAnchorTop = orderedBlocks
    .filter(block => {
      const [, top] = block.block_bbox;
      const nextNumber = block.block_content.trim().match(/^(\d+)(?:\s|[.、])/i)?.[1];
      return top > startTop && nextNumber && nextNumber !== displayNo && sameLane(block);
    })
    .map(block => block.block_bbox[1])
    .sort((first, second) => first - second)[0] ?? Number.POSITIVE_INFINITY;
  const questionBlocks = orderedBlocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.block_bbox[3] >= startTop && block.block_bbox[1] < nextAnchorTop && sameLane(block));
  if (evidenceId.endsWith('-answer')) return blockRegion(start.block, start.index);
  const embeddedMarker = evidenceId.match(/[①②③④⑤⑥⑦⑧⑨⑩]/)?.[0];
  const fieldIndex = Number(evidenceId.match(/-(\d+)$/)?.[1] ?? 0);
  const marker = embeddedMarker ?? circledNumbers[fieldIndex - 1];
  if (!marker) return undefined;
  for (const { block, index: blockIndex } of questionBlocks) {
    const lines = block.block_content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const lineIndex = lines.findIndex(line => line.includes(marker));
    if (lineIndex >= 0) return blockRegion(
      block,
      blockIndex,
      lineIndex,
      lines.length,
      extractPaddleFieldText(lines[lineIndex], marker),
      `${blockIndex}:${lineIndex}:${marker}`
    );
  }
  return undefined;
};

const alignBlockLineToInk = async (sourcePath: string, row: PaddleRow): Promise<PaddleRow | undefined> => {
  if (row.lineIndex === undefined || !row.lineCount || row.lineCount === 1) return row;
  const { data, info } = await sharp(sourcePath)
    .extract({ left: row.region.x, top: row.region.y, width: row.region.width, height: row.region.height })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const activeRows: number[] = [];
  for (let y = 0; y < info.height; y += 1) {
    let darkPixels = 0;
    for (let x = 0; x < info.width; x += 1) if (data[y * info.width + x] < 210) darkPixels += 1;
    const darkRatio = darkPixels / info.width;
    if (darkPixels >= Math.max(2, info.width * 0.015) && darkRatio < 0.7) activeRows.push(y);
  }
  const bands = activeRows.reduce<Array<{ top: number; bottom: number }>>((result, y) => {
    const current = result[result.length - 1];
    if (!current || y - current.bottom > 2) result.push({ top: y, bottom: y });
    else current.bottom = y;
    return result;
  }, []).filter(band => band.bottom - band.top >= 2);
  while (bands.length > row.lineCount) {
    let closestIndex = 0;
    let closestGap = Number.POSITIVE_INFINITY;
    for (let index = 0; index < bands.length - 1; index += 1) {
      const gap = bands[index + 1].top - bands[index].bottom;
      if (gap < closestGap) {
        closestGap = gap;
        closestIndex = index;
      }
    }
    bands.splice(closestIndex, 2, { top: bands[closestIndex].top, bottom: bands[closestIndex + 1].bottom });
  }
  const band = bands.length === row.lineCount ? bands[row.lineIndex] : undefined;
  if (!band) return undefined;
  const previous = bands[row.lineIndex - 1];
  const next = bands[row.lineIndex + 1];
  const upperBoundary = previous ? Math.floor((previous.bottom + band.top + 1) / 2) : 0;
  const lowerBoundary = next ? Math.floor((band.bottom + next.top + 1) / 2) : info.height;
  const top = row.region.y + Math.max(upperBoundary, band.top - 2);
  const bottom = row.region.y + Math.min(lowerBoundary, band.bottom + 3);
  return {
    ...row,
    region: { ...row.region, y: top, height: Math.max(1, bottom - top) }
  };
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

const paddleTextInsideRegion = (
  artifact: PaddleParserArtifact,
  pageNumber: number,
  region: PixelRegion
) => {
  const page = artifact.pages.find(candidate => candidate.pageNumber === pageNumber);
  if (!page) return '';
  const candidates = page.prunedResult.parsing_res_list
    .map(block => {
      const [left, top, right, bottom] = block.block_bbox;
      return { block, region: { x: left, y: top, width: right - left, height: bottom - top } };
    })
    .filter(({ block, region: blockRegion }) => block.block_content.trim() && overlapRatio(blockRegion, region) >= 0.2)
    .sort((first, second) => first.region.y - second.region.y || first.region.x - second.region.x);
  return candidates
    .filter(({ block }, index) => !candidates.some(({ block: other }, otherIndex) =>
      otherIndex !== index
      && other.block_content.trim().length > block.block_content.trim().length
      && other.block_content.includes(block.block_content.trim())
    ))
    .map(({ block }) => block.block_content.trim())
    .filter((text, index, all) => all.indexOf(text) === index)
    .join('\n');
};

const paddleTextForQuestion = (
  artifact: PaddleParserArtifact,
  pageNumber: number,
  region: PixelRegion,
  displayNo: string
) => {
  const lines = paddleTextInsideRegion(artifact, pageNumber, region)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const questionNumber = (line: string) => line.match(/^(\d+)(?:\s|[.、])/u)?.[1];
  const start = lines.findIndex(line => questionNumber(line) === displayNo);
  if (start < 0) return '';
  const next = lines.findIndex((line, index) => index > start && questionNumber(line) !== undefined && questionNumber(line) !== displayNo);
  return lines.slice(start, next < 0 ? undefined : next).join('\n');
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
    const visionIsChoice = Boolean(vision?.evidenceUnits.length && vision.evidenceUnits.every(unit => unit.kind === 'choice'));
    const paddleChoice = visionIsChoice && artifact ? choiceRowAcrossPages(artifact, displayNo) : undefined;
    const page = paddleChoice ? pageByNumber.get(paddleChoice.pageNumber) : vision ? pageByNumber.get(vision.pageNumber) : pageSources[0];
    if (!page) throw new Error('SOURCE_PAGE_NOT_FOUND');
    const metadata = await sharp(page.sourceImagePath).metadata();
    if (!metadata.width || !metadata.height) throw new Error('SOURCE_PAGE_INVALID');
    const fullPage = { x: 0, y: 0, width: metadata.width, height: metadata.height };
    const visualQuestion = vision ? toPixels(vision.boundingBox, metadata.width, metadata.height) : fullPage;
    const expectedIds = expectedEvidenceIds.get(displayNo) ?? [];
    const fallbackChoiceRow = paddleChoice?.row ?? (!vision && artifact && expectedIds.length === 1
      ? answerRowFromPaddle(artifact, page.pageNumber, displayNo, expectedIds[0], 'choice', visualQuestion)
      : undefined);
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
      const usePaddleGeometry = locatedRow && (evidence.kind === 'choice' || locatedRow.lineCount === 1);
      const paddleRow = usePaddleGeometry ? await alignBlockLineToInk(page.sourceImagePath, locatedRow) : undefined;
      return {
        evidence,
        visualRegion: toPixels(evidence.boundingBox, metadata.width!, metadata.height!),
        paddleRow,
        paddleText: locatedRow?.text ?? '',
        paddleTextKey: locatedRow?.textKey
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
      sourceEvidence.length && sourceEvidence.every(unit => unit.kind === 'choice') && paddleRows.length === evidencePlans.length ? 0 : 8
    );
    const questionFileName = `question-${displayNo}.jpg`;
    const questionPath = path.join(cropDirectory, questionFileName);
    await writeCrop(page.sourceImagePath, questionPath, questionRegion);
    const recognitionPath = path.join(cropDirectory, `question-${displayNo}-recognition.jpg`);
    await writeRecognitionCrop(page.sourceImagePath, recognitionPath, questionRegion);

    const rowUseCount = new Map<string, number>();
    for (const plan of evidencePlans) if (plan.paddleRow) rowUseCount.set(plan.paddleRow.key, (rowUseCount.get(plan.paddleRow.key) ?? 0) + 1);
    const textUseCount = new Map<string, number>();
    for (const plan of evidencePlans) if (plan.paddleTextKey) textUseCount.set(plan.paddleTextKey, (textUseCount.get(plan.paddleTextKey) ?? 0) + 1);
    const evidenceUnits = await Promise.all(evidencePlans.map(async ({ evidence, visualRegion, paddleRow, paddleText, paddleTextKey }, evidenceIndex) => {
      const rawRegion = answerPanel && evidence.evidenceId.endsWith('-answer')
        ? answerPanel
        : paddleRow
        ? rowUseCount.get(paddleRow.key) === 1
          ? paddleRow.region
          : { ...visualRegion, y: paddleRow.region.y, height: paddleRow.region.height }
        : visualRegion;
      const isInsideQuestion = containsRegion(questionPixels, rawRegion);
      const boundedRegion = paddleRow
        ? padRegion(rawRegion, questionRegion, 12, paddleRow.lineCount && paddleRow.lineCount > 1 ? 0 : 2)
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
        paddleText,
        paddleTextShared: Boolean(paddleTextKey && (textUseCount.get(paddleTextKey) ?? 0) > 1),
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
    const evidencePaddleText = [...new Set(evidenceUnits.map(unit => unit.paddleText.trim()).filter(Boolean))].join('\n');
    const visualEvidenceRegion = evidencePlans.length
      ? unionRegions(evidencePlans.map(plan => plan.visualRegion))
      : visualQuestion;
    const paddleText = evidenceUnits.length && evidenceUnits.every(unit => unit.kind === 'choice')
      ? evidencePaddleText
      : artifact
        ? paddleTextForQuestion(artifact, page.pageNumber, questionRegion, displayNo)
          || paddleTextInsideRegion(artifact, page.pageNumber, visualEvidenceRegion)
          || evidencePaddleText
        : evidencePaddleText;
    return {
      displayNo,
      region: { ...questionRegion, pageNumber: page.pageNumber },
      locatorSource: fallbackChoiceRow ? 'paddle-layout' : 'vision-layout',
      locationStatus: locationReasons.length ? 'needs-teacher' : 'located',
      locationReasons,
      paddleText,
      cropPath: recognitionPath,
      cropUrl: `/uploads/validation/${encodeURIComponent(taskId)}/${encodeURIComponent(assetId)}/${encodeURIComponent(questionFileName)}`,
      evidenceUnits
    };
  }));
};
