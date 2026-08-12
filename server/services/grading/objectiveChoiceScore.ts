/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const scoreObjectiveChoice = (selectedOption: string | null, standardAnswer: string, fullScore: number) => {
  if (!selectedOption) return null;
  const selected = selectedOption.trim().toUpperCase();
  const standard = standardAnswer.trim().toUpperCase();
  if (!/^[A-Z]$/.test(selected) || !/^[A-Z]$/.test(standard)) return null;
  return selected === standard ? fullScore : 0;
};
