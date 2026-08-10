/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DocumentAsset, NormalizedDocument } from '../../src/domain/types';

export interface StoredMaterial extends DocumentAsset {
  diskPath: string;
  publicUrl: string;
  normalizedDocument?: NormalizedDocument;
}

const dataDirectory = path.resolve('var/data');
const dataPath = path.join(dataDirectory, 'materials.json');
mkdirSync(dataDirectory, { recursive: true });

const loadMaterials = () => {
  try {
    const entries = JSON.parse(readFileSync(dataPath, 'utf8')) as [string, StoredMaterial[]][];
    return new Map(entries);
  } catch {
    return new Map<string, StoredMaterial[]>();
  }
};

const taskMaterials = loadMaterials();

const persistMaterials = () => {
  const temporaryPath = `${dataPath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify([...taskMaterials.entries()]));
  renameSync(temporaryPath, dataPath);
};

export const replaceMaterialsForKind = (taskId: string, kind: StoredMaterial['kind'], materials: StoredMaterial[]) => {
  const current = taskMaterials.get(taskId) ?? [];
  taskMaterials.set(taskId, [...current.filter(material => material.kind !== kind), ...materials]);
  persistMaterials();
};

export const getMaterials = (taskId: string) => taskMaterials.get(taskId) ?? [];

export const updateMaterial = (taskId: string, materialId: string, update: Partial<StoredMaterial>) => {
  const materials = taskMaterials.get(taskId) ?? [];
  const index = materials.findIndex(material => material.id === materialId);
  if (index < 0) return undefined;
  const next = { ...materials[index], ...update };
  taskMaterials.set(taskId, materials.map(material => material.id === materialId ? next : material));
  persistMaterials();
  return next;
};
