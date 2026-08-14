/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnalyzedQuestion } from '../../../src/domain/types';

export interface ExpectedAnswerField {
  fieldId: string;
  label: string;
  stem: string;
}

const blankCount = (stem: string) => stem.match(/_{2,}/g)?.length ?? 0;

export const buildExpectedAnswerFields = (question: AnalyzedQuestion): ExpectedAnswerField[] => {
  const units = question.subquestions.length ? question.subquestions : [question];
  return units.flatMap(unit => {
    const count = blankCount(unit.stem);
    return Array.from({ length: count }, (_, index) => ({
      fieldId: `${unit.displayNo}-${index + 1}`,
      label: `${unit.displayNo}第${index + 1}空`,
      stem: unit.stem
    }));
  });
};
