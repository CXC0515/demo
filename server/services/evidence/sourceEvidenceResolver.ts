/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnalysisEvidenceRef } from '../../../src/domain/types';
import { StoredMaterial } from '../../repositories/materialRepository';

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export const resolveSourceEvidence = (taskId: string, reference: AnalysisEvidenceRef, materials: StoredMaterial[]): AnalysisEvidenceRef => {
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
    return block?.boundingBox && block.pageNumber ? [block] : [];
  });
  const pageNumbers = [...new Set(selectedBlocks.map(block => block.pageNumber!))];
  const pageNumber = pageNumbers[0] ?? 1;
  const sourcePage = document.resources.find(resource => resource.role === 'source-page' && (resource.pageNumber ?? 1) === pageNumber);
  if (!sourcePage) {
    return {
      ...reference,
      evidenceMode: 'source-crop',
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

  const left = Math.min(...selectedBlocks.map(block => block.boundingBox!.x));
  const top = Math.min(...selectedBlocks.map(block => block.boundingBox!.y));
  const right = Math.max(...selectedBlocks.map(block => block.boundingBox!.x + block.boundingBox!.width));
  const bottom = Math.max(...selectedBlocks.map(block => block.boundingBox!.y + block.boundingBox!.height));
  const padding = 0.015;
  const boundingBox = {
    x: clamp(left - padding),
    y: clamp(top - padding),
    width: clamp(right + padding) - clamp(left - padding),
    height: clamp(bottom + padding) - clamp(top - padding)
  };
  const query = new URLSearchParams({
    page: String(pageNumber),
    x: String(boundingBox.x),
    y: String(boundingBox.y),
    width: String(boundingBox.width),
    height: String(boundingBox.height)
  });
  return {
    ...reference,
    evidenceMode: 'source-crop',
    pageNumber,
    boundingBox,
    imageUrl: `/api/grading-tasks/${encodeURIComponent(taskId)}/materials/${encodeURIComponent(material.id)}/evidence-crop?${query}`,
    sourcePageUrl: sourcePage.publicUrl,
    locatorStatus: 'located',
    locatorReasons: []
  };
};
