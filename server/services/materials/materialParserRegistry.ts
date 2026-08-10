/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDocumentParserConfig } from '../../config/documentParserConfig';
import { NormalizedDocument } from '../../../src/domain/types';
import { DocxMaterialParser } from './DocxMaterialParser';
import { MaterialParserError, MaterialParserInput } from './MaterialParser';
import { PaddleVisionMaterialParser } from './PaddleVisionMaterialParser';
import { TextMaterialParser } from './TextMaterialParser';

export const parseMaterial = async (input: MaterialParserInput): Promise<NormalizedDocument> => {
  const config = getDocumentParserConfig();
  const parsers = [new TextMaterialParser(), new DocxMaterialParser(config), new PaddleVisionMaterialParser(config)];
  const parser = parsers.find(candidate => candidate.supports(input));
  if (!parser) throw new MaterialParserError('MATERIAL_FORMAT_UNSUPPORTED');
  return parser.parse(input);
};
