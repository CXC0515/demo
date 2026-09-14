/** @license SPDX-License-Identifier: Apache-2.0 */

export interface AnswerFragmentRef {
  order: number;
  blockId: string;
  quote: string;
  occurrence: number;
}

export interface ResolvedAnswerFragment extends AnswerFragmentRef {
  resolvedQuote: string;
  matchStatus: 'exact' | 'normalized' | 'missing';
}

interface SourceBlock { id: string; text: string; }

const nthIndexOf = (source: string, target: string, occurrence: number) => {
  let from = 0;
  for (let index = 1; index <= occurrence; index += 1) {
    const found = source.indexOf(target, from);
    if (found < 0) return -1;
    if (index === occurrence) return found;
    from = found + Math.max(1, target.length);
  }
  return -1;
};

const withoutWhitespace = (value: string) => [...value].filter(character => !/\s/u.test(character)).join('');

const extractNormalizedQuote = (source: string, quote: string, occurrence: number) => {
  const characters = [...source];
  const compact: string[] = [];
  const sourceIndexes: number[] = [];
  characters.forEach((character, index) => {
    if (/\s/u.test(character)) return;
    compact.push(character);
    sourceIndexes.push(index);
  });
  const target = withoutWhitespace(quote);
  const compactSource = compact.join('');
  const compactIndex = nthIndexOf(compactSource, target, occurrence);
  if (compactIndex < 0 || !target) return undefined;
  const start = sourceIndexes[compactIndex];
  const end = sourceIndexes[compactIndex + [...target].length - 1];
  return start === undefined || end === undefined ? undefined : characters.slice(start, end + 1).join('');
};

export const bindAnswerFragments = (refs: AnswerFragmentRef[], blocks: SourceBlock[]) => {
  const blocksById = new Map(blocks.map(block => [block.id, block]));
  const fragments: ResolvedAnswerFragment[] = refs
    .slice()
    .sort((first, second) => first.order - second.order)
    .map(ref => {
      const block = blocksById.get(ref.blockId);
      const occurrence = Math.max(1, ref.occurrence || 1);
      if (!block || !ref.quote.trim()) return { ...ref, occurrence, resolvedQuote: '', matchStatus: 'missing' as const };
      const exactIndex = nthIndexOf(block.text, ref.quote, occurrence);
      if (exactIndex >= 0) return { ...ref, occurrence, resolvedQuote: block.text.slice(exactIndex, exactIndex + ref.quote.length), matchStatus: 'exact' as const };
      const normalized = extractNormalizedQuote(block.text, ref.quote, occurrence);
      return normalized
        ? { ...ref, occurrence, resolvedQuote: normalized, matchStatus: 'normalized' as const }
        : { ...ref, occurrence, resolvedQuote: '', matchStatus: 'missing' as const };
    });
  const missing = fragments.filter(fragment => fragment.matchStatus === 'missing');
  return {
    fragments,
    paddleText: fragments.map(fragment => fragment.resolvedQuote.trim()).filter(Boolean).join('\n'),
    reasons: missing.map(fragment => `OCR 原文片段未匹配：${fragment.blockId}`)
  };
};
