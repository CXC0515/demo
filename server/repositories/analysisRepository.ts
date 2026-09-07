/** @license SPDX-License-Identifier: Apache-2.0 */
import { FirstSectionAnalysis } from '../../src/domain/types';
import { workspaceMapStore } from './workspaceFileStore';
const store = () => workspaceMapStore<FirstSectionAnalysis>('first-section-analyses.json');
export const getFirstSectionAnalysis = (taskId: string) => store().values.get(taskId);
export const saveFirstSectionAnalysis = (analysis: FirstSectionAnalysis) => { const current = store(); current.values.set(analysis.taskId, analysis); current.persist(); return analysis; };
export const deleteFirstSectionAnalysis = (taskId: string) => { const current = store(); if (current.values.delete(taskId)) current.persist(); };
