/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { VisionValidationItem } from '../../src/domain/types';
import { isVisionValidationItemCurrent, NON_CHOICE_RECOGNITION_VERSION } from './visionValidationRepository';

const item = (overrides: Partial<VisionValidationItem> = {}): VisionValidationItem => ({
  displayNo: '1',
  region: { x: 0, y: 0, width: 1, height: 1, pageNumber: 1 },
  locatorSource: 'vision-layout',
  locationStatus: 'located',
  locationReasons: [],
  cropUrl: '/question-1.jpg',
  evidenceUnits: [],
  paddleText: '',
  lunaText: '',
  crossedOutText: [],
  selectedOption: null,
  visualEvidence: '',
  existingMarkings: [],
  confidence: 1,
  needsReview: false,
  ...overrides
});

test('invalidates every result from an older recognition pipeline', () => {
  assert.equal(isVisionValidationItemCurrent(item()), false);
  assert.equal(isVisionValidationItemCurrent(item({ pipelineVersion: NON_CHOICE_RECOGNITION_VERSION })), true);
  assert.equal(isVisionValidationItemCurrent(item({ evidenceUnits: [{ kind: 'choice' } as never] })), false);
});
