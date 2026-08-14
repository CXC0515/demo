/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { CalibrationSample } from './types';
import { orderCalibrationSamplesForTrial, selectCalibrationSamples } from './calibrationSamples';

const sample = (id: string, sampleType: CalibrationSample['sampleType']) => ({ id, sampleType } as CalibrationSample);

test('puts different representative sample types before repeated types', () => {
  const ordered = orderCalibrationSamplesForTrial([
    sample('risk-1', 'ocr-risk'),
    sample('risk-2', 'ocr-risk'),
    sample('high', 'high'),
    sample('low', 'low')
  ]);
  assert.deepEqual(ordered.map(item => item.id), ['risk-1', 'low', 'high', 'risk-2']);
});

test('selects only real samples without fabricating missing students', () => {
  const samples = [sample('one', 'high'), sample('two', 'low'), sample('three', 'middle')];
  assert.deepEqual(selectCalibrationSamples(samples, 5).map(item => item.id).sort(), ['one', 'three', 'two']);
});
