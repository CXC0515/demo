/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { KnowledgeNode, ReviewItem, SchoolClass, WorkbenchTask, WorkflowState } from '../../domain/types';
import GradingTaskManagement from './GradingTaskManagement';
import GradingWorkflow from './GradingWorkflow';

interface GradingWorkspaceProps {
  tasks: WorkbenchTask[];
  classes: SchoolClass[];
  defaultClassId: string;
  workflowStates: Record<string, WorkflowState>;
  knowledgeNodes: KnowledgeNode[];
  reviewQueue: ReviewItem[];
  lowConfidenceThreshold: number;
  ocrHumanReviewThreshold: number;
  ocrAutoPassThreshold: number;
  onCreateTask: (task: WorkbenchTask) => void;
  onEnterWorkflow: (task: WorkbenchTask) => void;
  onSelectTask: (task: WorkbenchTask) => void;
  onUpdateTask: (task: WorkbenchTask) => void;
  onUpdateState: (taskId: string, updated: Partial<WorkflowState>) => void;
  onSyncToProfiles: (aiResults: WorkflowState['aiResults']) => void;
  onConfirmReview: (reviewId: string, finalScore: number, changeReason: string) => void;
  onBounceToOcr: (reviewId: string) => void;
  onMarkAsSample: (studentName: string) => void;
  onShowToast: (message: string) => void;
}

export default function GradingWorkspace({
  tasks,
  classes,
  defaultClassId,
  workflowStates,
  knowledgeNodes,
  reviewQueue,
  lowConfidenceThreshold,
  ocrHumanReviewThreshold,
  ocrAutoPassThreshold,
  onCreateTask,
  onEnterWorkflow,
  onSelectTask,
  onUpdateTask,
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
          defaultClassId={defaultClassId}
          reviewQueue={reviewQueue}
          onCreateTask={onCreateTask}
          onEnterWorkflow={enterTask}
        />
      </section>
    );
  }

  const taskReviews = reviewQueue.filter(item => item.taskId === selectedTask.id || item.taskName === selectedTask.name);
  const workflowState = workflowStates[selectedTask.id];

  if (!workflowState) return null;

  return (
    <section className="animate-fade-in" id="grading-workspace-page">
      <GradingWorkflow
        workflowState={workflowState}
        classes={classes}
        tasks={tasks}
        selectedTask={selectedTask}
        knowledgeNodes={knowledgeNodes}
        reviewQueue={taskReviews}
        lowConfidenceThreshold={lowConfidenceThreshold}
        ocrHumanReviewThreshold={ocrHumanReviewThreshold}
        ocrAutoPassThreshold={ocrAutoPassThreshold}
        onBack={() => setSelectedTaskId(null)}
        onSelectTask={selectTask}
        onUpdateTask={onUpdateTask}
        onUpdateState={(updated) => onUpdateState(selectedTask.id, updated)}
        onSyncToProfiles={onSyncToProfiles}
        onConfirmReview={onConfirmReview}
        onBounceToOcr={onBounceToOcr}
        onMarkAsSample={onMarkAsSample}
        onShowToast={onShowToast}
      />
    </section>
  );
}
