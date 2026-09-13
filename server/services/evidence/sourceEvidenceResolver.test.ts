/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalysisEvidenceRef } from '../../../src/domain/types';
import { StoredMaterial } from '../../repositories/materialRepository';
import { resolveSourceEvidence } from './sourceEvidenceResolver';

const reference: AnalysisEvidenceRef = {
  assetKind: 'assignment',
  assetId: 'asset-1',
  fileName: '试题',
  blockIds: ['block-1'],
  quote: '题干'
};

const material = (sourceFormat: 'docx' | 'pdf', withCoordinates = true): StoredMaterial => ({
  id: 'asset-1',
  taskId: 'task-1',
  kind: 'assignment',
  fileName: sourceFormat === 'docx' ? '试题.docx' : '试题.pdf',
  mimeType: sourceFormat === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
  status: 'ready',
  diskPath: '/tmp/source',
  publicUrl: '/source',
  normalizedDocument: {
    assetId: 'asset-1',
    sourceFormat,
    markdown: '题干',
    blocks: [{
      id: 'block-1',
      order: 1,
      type: 'paragraph',
      text: '题干',
      pageNumber: 1,
      boundingBox: withCoordinates ? { x: 0.1, y: 0.2, width: 0.5, height: 0.1 } : undefined
    }],
    resources: [{ id: 'page-1', fileName: 'page-1.png', mimeType: 'image/png', publicUrl: '/page-1.png', role: 'source-page', pageNumber: 1 }],
    warnings: [],
    parsedAt: '2026-08-11T00:00:00.000Z'
  }
});

test('uses native text evidence for DOCX material', () => {
  const result = resolveSourceEvidence('task-1', reference, [material('docx')]);
  assert.equal(result.evidenceMode, 'native-text');
  assert.equal(result.locatorStatus, 'located');
});

test('builds a real source crop for PDF blocks with coordinates', () => {
  const result = resolveSourceEvidence('task-1', reference, [material('pdf')]);
  assert.equal(result.evidenceMode, 'source-crop');
  assert.equal(result.locatorStatus, 'located');
  assert.match(result.imageUrl ?? '', /evidence-crop/);
  assert.ok((result.boundingBox?.width ?? 0) > 0.5);
});

test('falls back to a full source page when PDF coordinates are unavailable', () => {
  const result = resolveSourceEvidence('task-1', reference, [material('pdf', false)]);
  assert.equal(result.locatorStatus, 'needs-visual');
  assert.equal(result.imageUrl, '/page-1.png');
});

test('keeps the original block crop when the quote covers almost the whole block', () => {
  const result = resolveSourceEvidence('task-1', { ...reference, quote: '题干', segments: [{ blockId: 'block-1', quote: '题干' }] }, [material('pdf')]);
  assert.equal(result.cropMode, 'block');
  assert.equal(result.blockImageUrl, undefined);
});

test('estimates a smaller vertical crop for an exact quote spanning a subset of block lines', () => {
  const source = material('pdf');
  source.normalizedDocument!.blocks[0].text = ['4. 第四题答案', '5. 第五题答案', '6. 第六题答案', '7. 第七题答案'].join('\n');
  source.normalizedDocument!.blocks[0].boundingBox = { x: 0.1, y: 0.2, width: 0.5, height: 0.6 };
  const result = resolveSourceEvidence('task-1', {
    ...reference,
    quote: '4. 第四题答案',
    segments: [{ blockId: 'block-1', quote: '4. 第四题答案' }]
  }, [source]);
  assert.equal(result.cropMode, 'estimated-segment');
  assert.ok((result.boundingBox?.height ?? 1) < 0.6);
  assert.match(result.blockImageUrl ?? '', /evidence-crop/);
});

test('keeps a single-line partial block intact because its visual wrap cannot be inferred', () => {
  const source = material('pdf');
  source.normalizedDocument!.blocks[0].text = '4. 第四题答案 5. 第五题答案';
  const result = resolveSourceEvidence('task-1', {
    ...reference,
    quote: '4. 第四题答案',
    segments: [{ blockId: 'block-1', quote: '4. 第四题答案' }]
  }, [source]);
  assert.equal(result.cropMode, 'block');
});
