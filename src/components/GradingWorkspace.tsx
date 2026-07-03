/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CheckSquare, FolderOpen, Workflow } from 'lucide-react';
import { ReviewItem, SchoolClass, WorkbenchTask, WorkflowState } from '../types';
import GradingTaskManagement from './GradingTaskManagement';
import GradingWorkflow from './GradingWorkflow';
import ReviewQueuePage from './ReviewQueuePage';

interface GradingWorkspaceProps {
  tasks: WorkbenchTask[];
  classes: SchoolClass[];
  workflowState: WorkflowState;
  reviewQueue: ReviewItem[];
  lowConfidenceThreshold: number;
  onCreateTask: (task: WorkbenchTask) => void;
  onEnterWorkflow: (task: WorkbenchTask) => void;
  onSelectTask: (task: WorkbenchTask) => void;
  onUpdateState: (updated: Partial<WorkflowState>) => void;
  onSyncToProfiles: () => void;
  onConfirmReview: (reviewId: string, finalScore: number, changeReason: string) => void;
  onBounceToOcr: (reviewId: string) => void;
  onMarkAsSample: (studentName: string) => void;
  onShowToast: (message: string) => void;
}

type GradingTab = 'tasks' | 'workflow' | 'review';

const tabs: { id: GradingTab; label: string; icon: React.ElementType }[] = [
  { id: 'tasks', label: '批改任务', icon: FolderOpen },
  { id: 'workflow', label: '批改工作流', icon: Workflow },
  { id: 'review', label: '复核队列', icon: CheckSquare }
];

export default function GradingWorkspace({
  tasks,
  classes,
  workflowState,
  reviewQueue,
  lowConfidenceThreshold,
  onCreateTask,
  onEnterWorkflow,
  onSelectTask,
  onUpdateState,
  onSyncToProfiles,
  onConfirmReview,
  onBounceToOcr,
  onMarkAsSample,
  onShowToast
}: GradingWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<GradingTab>('tasks');

  const handleEnterWorkflow = (task: WorkbenchTask) => {
    onEnterWorkflow(task);
    setActiveTab('workflow');
  };

  return (
    <div className="space-y-5 animate-fade-in" id="grading-workspace-page">
      <div className="glass-panel rounded-2xl p-2 flex flex-wrap gap-1.5 bg-slate-100/60 dark:bg-zinc-900/60">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 dark:bg-zinc-800 dark:text-slate-50 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'review' && reviewQueue.filter(r => r.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] bg-red-500 text-white rounded-full font-bold">
                  {reviewQueue.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'tasks' && (
        <GradingTaskManagement
          tasks={tasks}
          classes={classes}
          workflowState={workflowState}
          onCreateTask={onCreateTask}
          onEnterWorkflow={handleEnterWorkflow}
        />
      )}

      {activeTab === 'workflow' && (
        <GradingWorkflow
          workflowState={workflowState}
          classes={classes}
          tasks={tasks}
          onSelectTask={onSelectTask}
          onUpdateState={onUpdateState}
          onSyncToProfiles={onSyncToProfiles}
          onShowToast={onShowToast}
          lowConfidenceThreshold={lowConfidenceThreshold}
        />
      )}

      {activeTab === 'review' && (
        <ReviewQueuePage
          reviewQueue={reviewQueue}
          onConfirmReview={onConfirmReview}
          onBounceToOcr={onBounceToOcr}
          onMarkAsSample={onMarkAsSample}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
