/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentAsset } from '../../src/domain/types';

export interface StoredMaterial extends DocumentAsset {
  diskPath: string;
  publicUrl: string;
}

const taskMaterials = new Map<string, StoredMaterial[]>();

export const addMaterials = (taskId: string, materials: StoredMaterial[]) => {
  const current = taskMaterials.get(taskId) ?? [];
  taskMaterials.set(taskId, [...current, ...materials]);
};

export const getMaterials = (taskId: string) => taskMaterials.get(taskId) ?? [];
