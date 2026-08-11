/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationSample } from './types';

const sampleTypeOrder: CalibrationSample['sampleType'][] = ['ocr-risk', 'low', 'high', 'middle'];

export const orderCalibrationSamplesForTrial = (samples: CalibrationSample[]) => {
  const buckets = new Map(sampleTypeOrder.map(type => [type, samples.filter(sample => sample.sampleType === type)]));
  const ordered: CalibrationSample[] = [];
  while (ordered.length < samples.length) {
    for (const type of sampleTypeOrder) {
      const sample = buckets.get(type)?.shift();
      if (sample) ordered.push(sample);
    }
  }
  return ordered;
};
