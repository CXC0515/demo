/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, FilePlus2, Plus, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ReviewItem, SchoolClass, WorkbenchTask, WorkflowState } from '../../domain/types';

interface GradingTaskManagementProps {
  tasks: WorkbenchTask[];
  classes: SchoolClass[];
  workflowState: WorkflowState;
  reviewQueue: ReviewItem[];
  onCreateTask: (task: WorkbenchTask) => void;
  onEnterWorkflow: (task: WorkbenchTask) => void;
}

type TaskFilter = 'all' | 'active' | 'completed';

const statusLabel: Record<WorkbenchTask['status'], string> = {
  pending: '待处理',
  running: '进行中',
  completed: '已完成',
  error: '需关注'
};

export default function GradingTaskManagement({ tasks, classes, workflowState, reviewQueue, onCreateTask, onEnterWorkflow }: GradingTaskManagementProps) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('阅读理解作业');
  const [classId, setClassId] = useState(workflowState.classId);
  const [deadline, setDeadline] = useState('明天 18:00');

  const visibleTasks = useMemo(() => tasks.filter(task => {
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'active') return task.status !== 'completed';
    return true;
  }), [filter, tasks]);

  const createTask = () => {
    const schoolClass = classes.find(item => item.id === classId) ?? classes[0];
    onCreateTask({
      id: `task-${Date.now()}`,
      name: name.trim() || '未命名阅读理解作业',
      classId: schoolClass.id,
      className: schoolClass.name,
      node: 'upload',
      nodeName: '待上传作业',
      deadline,
      status: 'pending'
    });
    setShowCreate(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="glass-panel flex rounded-2xl bg-slate-100/60 p-2 dark:bg-zinc-900/60">
          {([['all', '全部任务'], ['active', '进行中'], ['completed', '已完成']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${filter === id ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-700/10 transition-all hover:bg-emerald-800 active:scale-95"><Plus className="h-4 w-4" />新建批改任务</button>
      </div>

      <section className="glass-panel overflow-hidden rounded-[24px]">
        <div className="hidden grid-cols-[minmax(260px,1.5fr)_150px_130px_110px_120px] border-b border-slate-200/70 px-5 py-3 text-xs font-bold text-slate-400 md:grid dark:border-zinc-800">
          <span>任务</span><span>班级</span><span>当前环节</span><span>异常</span><span />
        </div>
        {visibleTasks.map(task => {
          const exceptionCount = reviewQueue.filter(item => item.status === 'pending' && (item.taskId === task.id || item.taskName === task.name)).length;
          return (
            <article key={task.id} className="grid gap-3 border-b border-slate-200/60 px-5 py-4 last:border-0 md:grid-cols-[minmax(260px,1.5fr)_150px_130px_110px_120px] md:items-center dark:border-zinc-800/70">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><FilePlus2 className="h-4 w-4 flex-none text-emerald-700" /><h2 className="truncate text-sm font-black text-slate-900 dark:text-white">{task.name}</h2></div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{task.deadline}</span>{typeof task.progress === 'number' ? <span>{task.progress}%</span> : null}</div>
              </div>
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-300"><Users className="h-4 w-4 text-slate-400" />{task.className}</span>
              <span className={`w-fit rounded-xl px-2.5 py-1.5 text-xs font-bold ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : task.status === 'error' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-200'}`}>{statusLabel[task.status]} · {task.nodeName}</span>
              <span className={`flex w-fit items-center gap-1.5 text-xs font-bold ${exceptionCount ? 'text-rose-700' : 'text-slate-400'}`}>{exceptionCount ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{exceptionCount ? `${exceptionCount} 项` : '无待处理'}</span>
              <button type="button" onClick={() => onEnterWorkflow(task)} className="flex items-center justify-center gap-1 rounded-2xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-800 active:scale-95">进入任务<ArrowRight className="h-3.5 w-3.5" /></button>
            </article>
          );
        })}
      </section>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="新建批改任务">
          <div className="glass-panel w-full max-w-lg rounded-[24px] p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-900 dark:text-white">新建阅读理解批改任务</h2><button type="button" title="关闭" aria-label="关闭" onClick={() => setShowCreate(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button></div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-500">任务名称</span><input value={name} onChange={event => setName(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-900" /></label>
              <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-500">班级</span><select value={classId} onChange={event => setClassId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900">{classes.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-500">截止时间</span><input value={deadline} onChange={event => setDeadline(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-900" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-zinc-700 dark:text-slate-300">取消</button><button type="button" onClick={createTask} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">创建任务</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
