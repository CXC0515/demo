/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const artifactDirectory = path.resolve('var/data/parser-artifacts');
mkdirSync(artifactDirectory, { recursive: true });

const artifactPath = (assetId: string) => path.join(artifactDirectory, `${assetId}.json`);

export const saveParserArtifact = (assetId: string, artifact: unknown) => {
  const target = artifactPath(assetId);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, JSON.stringify(artifact));
  renameSync(temporary, target);
};

export const mergeParserArtifactPages = (
  assetId: string,
  artifact: { model: string; jobId: string; dataInfo: unknown; pages: Array<{ pageNumber: number } & Record<string, unknown>> },
) => {
  const current = getParserArtifact(assetId) as { pages?: Array<{ pageNumber: number } & Record<string, unknown>> } | undefined;
  const replaced = new Set(artifact.pages.map((page) => page.pageNumber));
  saveParserArtifact(assetId, {
    ...artifact,
    pages: [...(current?.pages ?? []).filter((page) => !replaced.has(page.pageNumber)), ...artifact.pages]
      .sort((left, right) => left.pageNumber - right.pageNumber),
  });
};

export const getParserArtifact = (assetId: string) => {
  try {
    return JSON.parse(readFileSync(artifactPath(assetId), 'utf8')) as unknown;
  } catch {
    return undefined;
  }
};
