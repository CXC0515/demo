/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaddleParserArtifact } from '../../schemas/paddleParserArtifact';

export interface QuestionAnchor {
  displayNo: string;
  pageNumber: number;
  text: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface AnchoredQuestionRegion {
  anchor: QuestionAnchor;
  boundingBox: { x: number; y: number; width: number; height: number };
  recognitionBoundingBox: { x: number; y: number; width: number; height: number };
  ocrText: string;
}

const parseQuestionNo = (text: string) => {
  const normalized = text.trim();
  const prefixed = normalized.match(/^第\s*(\d{1,3})\s*题/u)?.[1];
  if (prefixed) return prefixed;
  return normalized.match(/^(\d{1,3})(?=[.．、。:：\]\[】]|\s)/u)?.[1];
};

const centerX = (anchor: QuestionAnchor) => anchor.boundingBox.x + anchor.boundingBox.width / 2;

const transitionCost = (previous: QuestionAnchor, current: QuestionAnchor, pageWidth: number, pageHeight: number) => {
  if (current.pageNumber !== previous.pageNumber) {
    return current.pageNumber > previous.pageNumber ? current.pageNumber - previous.pageNumber : 100;
  }
  const dx = (current.boundingBox.x - previous.boundingBox.x) / pageWidth;
  const dy = (current.boundingBox.y - previous.boundingBox.y) / pageHeight;
  const sameLane = Math.abs(dx) <= 0.16;
  if (sameLane) return dy > 0 ? dy : 20 + Math.abs(dy);
  if (dx > 0.16) return 0.35 + Math.max(0, dy) + Math.max(0, -dy) * 0.1;
  return 1.5 + Math.abs(dx) + Math.max(0, -dy);
};

const selectSequence = (candidatesByNo: Map<string, QuestionAnchor[]>, orderedNos: string[], artifact: PaddleParserArtifact) => {
  const ocrPages = artifact.ocrPages ?? [];
  const availableNos = orderedNos.filter(displayNo => candidatesByNo.has(displayNo));
  const costs = new Map<QuestionAnchor, number>();
  const previousByAnchor = new Map<QuestionAnchor, QuestionAnchor | undefined>();
  for (const [numberIndex, displayNo] of availableNos.entries()) {
    const candidates = candidatesByNo.get(displayNo) ?? [];
    const previousCandidates = numberIndex ? candidatesByNo.get(availableNos[numberIndex - 1]) ?? [] : [];
    for (const candidate of candidates) {
      if (!previousCandidates.length) {
        costs.set(candidate, 1 - candidate.confidence);
        continue;
      }
      let bestCost = Number.POSITIVE_INFINITY;
      let bestPrevious: QuestionAnchor | undefined;
      for (const previous of previousCandidates) {
        const page = ocrPages.find(item => item.pageNumber === candidate.pageNumber)
          ?? ocrPages.find(item => item.pageNumber === previous.pageNumber);
        const cost = (costs.get(previous) ?? Number.POSITIVE_INFINITY)
          + transitionCost(previous, candidate, page?.width ?? 1, page?.height ?? 1)
          + (1 - candidate.confidence) * 0.2;
        if (cost < bestCost) {
          bestCost = cost;
          bestPrevious = previous;
        }
      }
      costs.set(candidate, bestCost);
      previousByAnchor.set(candidate, bestPrevious);
    }
  }
  const lastNo = availableNos.at(-1);
  if (!lastNo) return [];
  let current = [...(candidatesByNo.get(lastNo) ?? [])]
    .sort((first, second) => (costs.get(first) ?? Number.POSITIVE_INFINITY) - (costs.get(second) ?? Number.POSITIVE_INFINITY))[0];
  const selected: QuestionAnchor[] = [];
  while (current) {
    selected.push(current);
    current = previousByAnchor.get(current);
  }
  return selected.reverse();
};

const clusterLaneStarts = (anchors: QuestionAnchor[], pageWidth: number) => {
  const starts: number[] = [];
  for (const anchor of [...anchors].sort((first, second) => first.boundingBox.x - second.boundingBox.x)) {
    const existing = starts.findIndex(value => Math.abs(value - anchor.boundingBox.x) <= pageWidth * 0.1);
    if (existing < 0) starts.push(anchor.boundingBox.x);
    else starts[existing] = Math.min(starts[existing], anchor.boundingBox.x);
  }
  return starts.sort((first, second) => first - second);
};

const lineInside = (line: QuestionAnchor, region: AnchoredQuestionRegion['boundingBox']) => {
  const x = centerX(line);
  const y = line.boundingBox.y + line.boundingBox.height / 2;
  return x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height;
};

export const resolveQuestionAnchors = (
  artifact: PaddleParserArtifact,
  knownQuestionNos: string[]
): Map<string, AnchoredQuestionRegion> => {
  const ocrPages = artifact.ocrPages ?? [];
  if (!ocrPages.length) return new Map();
  const known = new Set(knownQuestionNos);
  const orderedNos = [...known].sort((first, second) => Number(first) - Number(second));
  const candidatesByNo = new Map<string, QuestionAnchor[]>();
  for (const page of ocrPages) {
    for (const line of page.lines) {
      const displayNo = parseQuestionNo(line.text);
      if (!displayNo || !known.has(displayNo)) continue;
      const [left, top, right, bottom] = line.boundingBox;
      const candidate: QuestionAnchor = {
        displayNo,
        pageNumber: page.pageNumber,
        text: line.text.trim(),
        confidence: line.confidence,
        boundingBox: { x: left, y: top, width: right - left, height: bottom - top }
      };
      candidatesByNo.set(displayNo, [...(candidatesByNo.get(displayNo) ?? []), candidate]);
    }
  }
  const selected = selectSequence(candidatesByNo, orderedNos, artifact);
  const result = new Map<string, AnchoredQuestionRegion>();
  for (const anchor of selected) {
    const page = ocrPages.find(item => item.pageNumber === anchor.pageNumber);
    if (!page) continue;
    const pageAnchors = selected.filter(item => item.pageNumber === anchor.pageNumber);
    const laneStarts = clusterLaneStarts(pageAnchors, page.width);
    const laneIndex = laneStarts.reduce((best, start, index) =>
      Math.abs(start - anchor.boundingBox.x) < Math.abs(laneStarts[best] - anchor.boundingBox.x) ? index : best, 0);
    const laneStart = laneStarts[laneIndex];
    const nextLaneStart = laneStarts[laneIndex + 1];
    const left = Math.max(0, laneStart - page.width * 0.02);
    const right = nextLaneStart === undefined ? page.width : Math.max(left + 1, nextLaneStart - page.width * 0.01);
    const nextInLane = pageAnchors
      .filter(item => item !== anchor
        && Math.abs(item.boundingBox.x - laneStart) <= page.width * 0.1
        && item.boundingBox.y > anchor.boundingBox.y)
      .sort((first, second) => first.boundingBox.y - second.boundingBox.y)[0];
    const top = Math.max(0, anchor.boundingBox.y - page.height * 0.004);
    const bottom = nextInLane
      ? Math.min(page.height, nextInLane.boundingBox.y + page.height * 0.004)
      : page.height;
    const boundingBox = { x: left, y: top, width: right - left, height: Math.max(1, bottom - top) };
    const recognitionBottom = nextInLane
      ? Math.max(top + 1, nextInLane.boundingBox.y - page.height * 0.002)
      : page.height;
    const recognitionBoundingBox = {
      x: left,
      y: top,
      width: right - left,
      height: Math.max(1, recognitionBottom - top)
    };
    const ocrText = page.lines
      .map(line => {
        const [lineLeft, lineTop, lineRight, lineBottom] = line.boundingBox;
        return {
          ...line,
          displayNo: parseQuestionNo(line.text) ?? '',
          pageNumber: page.pageNumber,
          boundingBox: { x: lineLeft, y: lineTop, width: lineRight - lineLeft, height: lineBottom - lineTop }
        } satisfies QuestionAnchor;
      })
      .filter(line => lineInside(line, boundingBox))
      .sort((first, second) => first.boundingBox.y - second.boundingBox.y || first.boundingBox.x - second.boundingBox.x)
      .map(line => line.text.trim())
      .filter(Boolean)
      .join('\n');
    result.set(anchor.displayNo, { anchor, boundingBox, recognitionBoundingBox, ocrText });
  }
  return result;
};
