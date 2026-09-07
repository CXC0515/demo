/** @license SPDX-License-Identifier: Apache-2.0 */
import { TrialGradingResult } from '../../src/domain/types';
import { workspaceMapStore } from './workspaceFileStore';
const store = () => workspaceMapStore<TrialGradingResult>('trial-grading-results.json');
export const getTrialGradingResult = (taskId: string) => store().values.get(taskId);
export const saveTrialGradingResult = (result: TrialGradingResult) => { const current = store(); current.values.set(result.taskId, result); current.persist(); return result; };
export const deleteTrialGradingResult = (taskId: string) => { const current = store(); if (current.values.delete(taskId)) current.persist(); };
export const invalidateAiGradingForAsset = (taskId: string, assetId: string) => { const current = store(); const result = current.values.get(taskId); if (!result) return; const samples = result.samples.filter(sample => sample.sourceAssetId !== assetId || sample.resultSource === 'teacher-manual'); if (samples.length === result.samples.length) return; current.values.set(taskId, { ...result, samples, createdAt: new Date().toISOString() }); current.persist(); };
