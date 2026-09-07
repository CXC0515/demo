/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentAsset, NormalizedDocument } from '../../src/domain/types';
import { workspaceMapStore } from './workspaceFileStore';

export interface StoredMaterial extends DocumentAsset {
  diskPath: string;
  publicUrl: string;
  normalizedDocument?: NormalizedDocument;
}

const store = () => workspaceMapStore<StoredMaterial[]>('materials.json');

export const appendMaterialList = (current: StoredMaterial[], materials: StoredMaterial[]) => [...current, ...materials];

export const replaceMaterialsForKind = (taskId: string, kind: StoredMaterial['kind'], materials: StoredMaterial[]) => {
  const { values: taskMaterials, persist: persistMaterials } = store();
  const current = taskMaterials.get(taskId) ?? [];
  taskMaterials.set(taskId, [...current.filter(material => material.kind !== kind), ...materials]);
  persistMaterials();
};

export const appendMaterials = (taskId: string, materials: StoredMaterial[]) => {
  const { values: taskMaterials, persist: persistMaterials } = store();
  const current = taskMaterials.get(taskId) ?? [];
  taskMaterials.set(taskId, appendMaterialList(current, materials));
  persistMaterials();
};

export const getMaterials = (taskId: string) => store().values.get(taskId) ?? [];

export const updateMaterial = (taskId: string, materialId: string, update: Partial<StoredMaterial>) => {
  const { values: taskMaterials, persist: persistMaterials } = store();
  const materials = taskMaterials.get(taskId) ?? [];
  const index = materials.findIndex(material => material.id === materialId);
  if (index < 0) return undefined;
  const next = { ...materials[index], ...update };
  taskMaterials.set(taskId, materials.map(material => material.id === materialId ? next : material));
  persistMaterials();
  return next;
};

export const removeMaterialsForKind = (taskId: string, kind: StoredMaterial['kind']) => {
  const { values: taskMaterials, persist: persistMaterials } = store();
  const current = taskMaterials.get(taskId) ?? [];
  const removed = current.filter(material => material.kind === kind);
  taskMaterials.set(taskId, current.filter(material => material.kind !== kind));
  persistMaterials();
  return removed;
};
