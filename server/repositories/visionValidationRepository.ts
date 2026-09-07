/** @license SPDX-License-Identifier: Apache-2.0 */
import { VisionValidationResult } from '../../src/domain/types';
import { workspaceMapStore } from './workspaceFileStore';
const store = () => workspaceMapStore<VisionValidationResult>('vision-validation-results.json');
const keyFor = (taskId: string, assetId: string) => `${taskId}:${assetId}`;
export const NON_CHOICE_RECOGNITION_VERSION = 10;
export const isVisionValidationItemCurrent = (item: VisionValidationResult['items'][number]) => item.pipelineVersion === NON_CHOICE_RECOGNITION_VERSION;
export const getVisionValidationResult = (taskId: string, assetId: string) => { const result = store().values.get(keyFor(taskId, assetId)); return result ? { ...result, items: result.items.filter(isVisionValidationItemCurrent) } : undefined; };
export const saveVisionValidationResult = (result: VisionValidationResult) => { const current = store(); current.values.set(keyFor(result.taskId, result.assetId), result); current.persist(); return result; };
export const deleteVisionValidationForTask = (taskId: string) => { const current = store(); let changed = false; for (const key of current.values.keys()) if (key.startsWith(`${taskId}:`)) { current.values.delete(key); changed = true; } if (changed) current.persist(); };
