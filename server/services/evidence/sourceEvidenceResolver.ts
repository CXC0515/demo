/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnalysisEvidenceRef } from '../../../src/domain/types';
import { StoredMaterial } from '../../repositories/materialRepository';

const clamp = (value: number) => Math.min(1, Math.max(0, value));

type EvidenceBlock = NonNullable<StoredMaterial['normalizedDocument']>['blocks'][number] & {
  boundingBox: NonNullable<NonNullable<StoredMaterial['normalizedDocument']>['blocks'][number]['boundingBox']>;
  pageNumber: number;
};

const comparableLength = (value: string) => value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').length;

const estimateSegmentBox = (block: EvidenceBlock, quote: string) => {
  const blockLength = comparableLength(block.text);
  const quoteLength = comparableLength(quote);
  if (!blockLength || quoteLength / blockLength >= 0.85) return { box: block.boundingBox, estimated: false };
  const start = block.text.indexOf(quote);
  const lines = block.text.split(/\r?\n/);
  if (start < 0 || lines.length < 2) return { box: block.boundingBox, estimated: false };
  const end = start + quote.length;
  const startLine = block.text.slice(0, start).split(/\r?\n/).length - 1;
  const endLine = block.text.slice(0, end).split(/\r?\n/).length - 1;
  const coveredLines = Math.max(1, endLine - startLine + 1);
  if (coveredLines / lines.length >= 0.85) return { box: block.boundingBox, estimated: false };
  const lineHeight = block.boundingBox.height / lines.length;
  const verticalPadding = lineHeight * 0.65;
  const top = Math.max(block.boundingBox.y, block.boundingBox.y + startLine * lineHeight - verticalPadding);
  const bottom = Math.min(block.boundingBox.y + block.boundingBox.height, block.boundingBox.y + (endLine + 1) * lineHeight + verticalPadding);
  return {
    box: { x: block.boundingBox.x, y: top, width: block.boundingBox.width, height: bottom - top },
    estimated: true
  };
};

const unionBoxes = (boxes: Array<{ x: number; y: number; width: number; height: number }>, padding = 0.015) => {
  const left = Math.min(...boxes.map(box => box.x));
  const top = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.width));
  const bottom = Math.max(...boxes.map(box => box.y + box.height));
  return {
    x: clamp(left - padding),
    y: clamp(top - padding),
    width: clamp(right + padding) - clamp(left - padding),
    height: clamp(bottom + padding) - clamp(top - padding)
  };
};

const intersectBoxes = (
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
) => {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  if (right <= left || bottom <= top) return null;
  const intersection = { x: left, y: top, width: right - left, height: bottom - top };
  const requestedArea = first.width * first.height;
  const intersectionArea = intersection.width * intersection.height;
  return requestedArea > 0 && intersectionArea / requestedArea >= 0.6 ? intersection : null;
};

const cropUrl = (taskId: string, assetId: string, pageNumber: number, box: { x: number; y: number; width: number; height: number }) => {
  const query = new URLSearchParams({
    page: String(pageNumber),
    x: String(box.x),
    y: String(box.y),
    width: String(box.width),
    height: String(box.height)
  });
  return `/api/grading-tasks/${encodeURIComponent(taskId)}/materials/${encodeURIComponent(assetId)}/evidence-crop?${query}`;
};

export const resolveSourceEvidence = (taskId: string, reference: AnalysisEvidenceRef, materials: StoredMaterial[], useWholeQuestionVisualRegion = false): AnalysisEvidenceRef => {
  const material = materials.find(item => item.id === reference.assetId && item.kind === reference.assetKind);
  const document = material?.normalizedDocument;
  if (!material || !document) {
    return { ...reference, locatorStatus: 'needs-teacher', locatorReasons: ['来源材料不可用'] };
  }
  if (document.sourceFormat === 'docx' || document.sourceFormat === 'text') {
    return {
      ...reference,
      evidenceMode: 'native-text',
      locatorStatus: 'located',
      locatorReasons: []
    };
  }

  const selectedBlocks = reference.blockIds.flatMap(id => {
    const block = document.blocks.find(item => item.id === id);
    return block?.boundingBox && block.pageNumber ? [block as EvidenceBlock] : [];
  });
  const isPartialBlock = selectedBlocks.length > 0
    && selectedBlocks.map(block => block.text.trim()).join('\n') !== reference.quote.trim();
  const pageNumbers = [...new Set(selectedBlocks.map(block => block.pageNumber!))];
  const pageNumber = pageNumbers[0] ?? 1;
  const sourcePage = document.resources.find(resource => resource.role === 'source-page' && (resource.pageNumber ?? 1) === pageNumber);
  if (!sourcePage) {
    return {
      ...reference,
      evidenceMode: 'source-crop',
      isPartialBlock,
      pageNumber,
      locatorStatus: 'needs-teacher',
      locatorReasons: ['原始页面图像不可用']
    };
  }
  if (!selectedBlocks.length || pageNumbers.length !== 1) {
    return {
      ...reference,
      evidenceMode: 'source-crop',
      pageNumber,
      imageUrl: sourcePage.publicUrl,
      sourcePageUrl: sourcePage.publicUrl,
      locatorStatus: 'needs-visual',
      locatorReasons: [selectedBlocks.length ? '证据跨越多个页面' : '未取得可用文字坐标']
    };
  }

  const selectedBlockBoxes = selectedBlocks.map(block => block.boundingBox);
  const blockConstraintBox = unionBoxes(selectedBlockBoxes, 0);
  const blockBoundingBox = unionBoxes(selectedBlockBoxes);
  const blocksById = new Map(selectedBlocks.map(block => [block.id, block]));
  const segmentBoxes = (reference.segments ?? []).flatMap(segment => {
    const block = blocksById.get(segment.blockId);
    return block ? [estimateSegmentBox(block, segment.quote)] : [];
  });
  const canUseEstimatedSegment = isPartialBlock
    && segmentBoxes.length === (reference.segments?.length ?? 0)
    && segmentBoxes.some(segment => segment.estimated);
  const visualBoundingBox = useWholeQuestionVisualRegion
    && isPartialBlock
    && reference.visualRegion?.pageNumber === pageNumber
    ? intersectBoxes(reference.visualRegion.boundingBox, blockConstraintBox)
    : null;
  const boundingBox = canUseEstimatedSegment
    ? unionBoxes(segmentBoxes.map(segment => segment.box))
    : visualBoundingBox ?? blockBoundingBox;
  const cropMode = canUseEstimatedSegment
    ? 'estimated-segment' as const
    : visualBoundingBox
      ? 'model-within-block' as const
      : 'block' as const;
  return {
    ...reference,
    evidenceMode: 'source-crop',
    isPartialBlock,
    pageNumber,
    boundingBox,
    cropMode,
    imageUrl: cropUrl(taskId, material.id, pageNumber, boundingBox),
    blockImageUrl: cropMode !== 'block' ? cropUrl(taskId, material.id, pageNumber, blockBoundingBox) : undefined,
    sourcePageUrl: sourcePage.publicUrl,
    locatorStatus: 'located',
    locatorReasons: []
  };
};
