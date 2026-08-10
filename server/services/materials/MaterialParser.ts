/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NormalizedDocument } from '../../../src/domain/types';

export interface MaterialParserInput {
  assetId: string;
  fileName: string;
  mimeType: string;
  filePath: string;
}

export interface MaterialParser {
  supports(input: MaterialParserInput): boolean;
  parse(input: MaterialParserInput): Promise<NormalizedDocument>;
}

export class MaterialParserError extends Error {
  constructor(public readonly code: string, options?: ErrorOptions) {
    super(code, options);
  }
}
