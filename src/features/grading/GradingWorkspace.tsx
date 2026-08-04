/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ReviewItem, SchoolClass, WorkbenchTask, WorkflowState } from '../../domain/types';
import GradingTaskManagement from './GradingTaskManagement';
import GradingWorkflow from './GradingWorkflow';

interface GradingWorkspaceProps {
  tasks: WorkbenchTask[];
  classes: SchoolClass[];
  workflowState: WorkflowState;
  reviewQueue: ReviewItem[];
  lowConfidenceThreshold: number;
  ocrHumanReviewThreshold: number;
  ocrAutoPassThreshold: number;
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

export default function GradingWorkspace({
  tasks,
  classes,
  workflowState,
  reviewQueue,
  lowConfidenceThreshold,
  ocrHumanReviewThreshold,
  ocrAutoPassThreshold,
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = tasks.find(task => task.id === selectedTaskId) ?? null;

  const enterTask = (task: WorkbenchTask) => {
    onEnterWorkflow(task);
    setSelectedTaskId(task.id);
  };

  const selectTask = (task: WorkbenchTask) => {
    onSelectTask(task);
    setSelectedTaskId(task.id);
  };

  if (!selectedTask) {
    return (
      <section className="animate-fade-in" id="grading-workspace-page">
        <GradingTaskManagement
          tasks={tasks}
          classes={classes}
          workflowState={workflowState}
          reviewQueue={reviewQueue}
          onCreateTask={onCreateTask}
          onEnterWorkflow={enterTask}
        />
      </section>
    );
  }

  const taskReviews = reviewQueue.filter(item => item.taskId === selectedTask.id || item.taskName === selectedTask.name);

  return (
    <section className="animate-fade-in" id="grading-workspace-page">
      <GradingWorkflow
        workflowState={workflowState}
        classes={classes}
        tasks={tasks}
        selectedTask={selectedTask}
        reviewQueue={taskReviews}
        lowConfidenceThreshold={lowConfidenceThreshold}
        ocrHumanReviewThreshold={ocrHumanReviewThreshold}
        ocrAutoPassThreshold={ocrAutoPassThreshold}
        onBack={() => setSelectedTaskId(null)}
        onSelectTask={selectTask}
        onUpdateState={onUpdateState}
        onSyncToProfiles={onSyncToProfiles}
        onConfirmReview={onConfirmReview}
        onBounceToOcr={onBounceToOcr}
        onMarkAsSample={onMarkAsSample}
        onShowToast={onShowToast}
      />
    </section>
  );
}
