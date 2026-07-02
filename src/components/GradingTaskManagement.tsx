/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, Plus, Search, Workflow } from 'lucide-react';
import { SchoolClass, WorkbenchTask, WorkflowState } from '../types';

interface GradingTaskManagementProps {
  tasks: WorkbenchTask[];
  classes: SchoolClass[];
  onCreateTask: (task: WorkbenchTask) => void;
  onEnterWorkflow: (task: WorkbenchTask) => void;
  workflowState: WorkflowState;
}

const nodeTone: Record<string, string> = {
  upload: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  ocr: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  grading: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200',
  verify: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
  report: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  sync: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-200'
};

export default function GradingTaskManagement({
  tasks,
  classes,
  onCreateTask,
  onEnterWorkflow,
  workflowState
}: GradingTaskManagementProps) {
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [taskName, setTaskName] = useState('《驿路梨花》标题作用题专项批改');
  const [classId, setClassId] = useState(classes[0]?.id ?? 'c1');

  const gradingTasks = tasks.filter(t => `${t.name}${t.className}${t.nodeName}`.includes(query));

  const createTask = () => {
    const cls = classes.find(c => c.id === classId) ?? classes[0];
    onCreateTask({
      id: `task-${Date.now()}`,
      name: taskName,
      classId,
      className: cls?.name ?? '未选择班级',
      node: 'upload',
      nodeName: '上传学生作业',
      deadline: '明天 18:00',
      status: 'pending',
      progress: 10
    });
    setShowCreate(false);
  };

  return (
    <div className="space-y-5 animate-fade-in" id="grading-task-management-page">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">AI 批改 / 任务管理</p>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">批改任务管理</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">先创建任务，再进入作业工作流逐步配置题目、评分细则、上传作业和复核结果。</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2.5 rounded-2xl bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-all">
          <Plus className="w-4 h-4" />
          新建批改任务
        </button>
      </div>

      <div className="glass-panel rounded-[24px] overflow-hidden">
        <div className="p-4 border-b border-slate-200/70 dark:border-zinc-800/80 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索任务、班级、节点" className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 text-sm focus:outline-none" />
          </div>
          <div className="text-xs text-slate-400">当前工作流：{workflowState.taskName}</div>
        </div>

        <div className="grid grid-cols-[1fr_140px_140px_120px_120px] px-5 py-3 text-[11px] font-black text-slate-400 uppercase border-b border-slate-200/70 dark:border-zinc-800/80">
          <span>任务</span>
          <span>班级</span>
          <span>当前节点</span>
          <span>进度</span>
          <span>操作</span>
        </div>
        {gradingTasks.map(task => (
          <div key={task.id} className="grid grid-cols-[1fr_140px_140px_120px_120px] px-5 py-4 items-center border-b border-slate-200/60 dark:border-zinc-800/70 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-all">
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-slate-100">{task.name}</p>
              <p className="text-xs text-slate-400 mt-1">截止：{task.deadline}</p>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-300">{task.className}</span>
            <span className={`w-fit px-2 py-1 rounded-full text-xs font-bold ${nodeTone[task.node] ?? nodeTone.sync}`}>{task.nodeName}</span>
            <div className="w-20 h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${task.progress ?? 0}%` }} />
            </div>
            <button onClick={() => onEnterWorkflow(task)} className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              进入
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass-panel rounded-[24px] p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <Workflow className="w-5 h-5 text-emerald-700" />
              新建批改任务
            </h3>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-400">任务名称</span>
              <input value={taskName} onChange={(e) => setTaskName(e.target.value)} className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm focus:outline-none" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-400">班级</span>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm focus:outline-none">
                {classes.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 text-xs font-bold">取消</button>
              <button onClick={createTask} className="px-4 py-2 rounded-2xl bg-emerald-700 text-white text-xs font-bold">创建并进入任务池</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
