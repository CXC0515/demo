/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Upload, FileSearch, Sparkles, CheckSquare, FileText, AlertTriangle, 
  Clock, ArrowRight, BookOpen, Calendar, UserMinus, ShieldAlert, Award, MessageSquare 
} from 'lucide-react';
import { Student, SchoolClass, WorkbenchTask, ScheduleItem, TimerReminder } from '../types';

interface WorkbenchProps {
  tasks: WorkbenchTask[];
  classes: SchoolClass[];
  students: Student[];
  schedule: ScheduleItem[];
  reminders: TimerReminder[];
  selectedClassId: string;
  onNavigate: (pageId: string, subPageId?: string) => void;
  onEnterClass: (classId: string) => void;
  onSelectTask: (taskId: string) => void;
  onTriggerTask: (task: WorkbenchTask) => void;
}

export default function Workbench({
  tasks,
  classes,
  students,
  schedule,
  reminders,
  selectedClassId,
  onNavigate,
  onEnterClass,
  onSelectTask,
  onTriggerTask
}: WorkbenchProps) {
  // Group tasks by node
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // Filter student risks/abnormalities
  const riskStudents = students.filter(s => s.status === 'risk');
  const warningStudents = students.filter(s => s.status === 'warning');
  const outstandingStudents = students.filter(s => s.status === 'outstanding');

  // Today is Wednesday (day = 3) for mock purposes
  const todaySchedule = schedule.filter(s => s.day === 3);

  // Active reminders
  const activeReminders = reminders.filter(r => r.status === 'active');

  const getNodeIcon = (node: string) => {
    switch (node) {
      case 'upload': return <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'ocr': return <FileSearch className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'grading': return <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'verify': return <CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'report': return <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />;
      default: return <Clock className="w-5 h-5 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse">进行中</span>;
      case 'error':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">异常</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">待处理</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="workbench-page">
      {/* Welcome banner & Virtual Room Quick Access */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-emerald-500/5 to-teal-500/10 dark:from-emerald-500/10 dark:to-teal-500/20">
          <div className="space-y-2 z-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">语文教学综合控制台</span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              您好，王老师。
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
              今日工作重心：您有 <span className="font-semibold text-emerald-700 dark:text-emerald-400">{pendingTasks.length}</span> 项待处理的教学任务。
              七年级 3 班《驿路梨花》阅读理解检测已被 AI 自动批改完成，包含 4 份低置信度答案，等待您的最终人工复核。
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 z-10">
            <button 
              id="wb-quick-action"
              onClick={() => onNavigate('grading-flow')}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-sm font-medium rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-700/10 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              开启新作业批改
            </button>
            <button 
              id="wb-config-btn"
              onClick={() => onNavigate('settings')}
              className="px-4 py-2.5 bg-white/80 hover:bg-white dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl border border-slate-200 dark:border-zinc-700 transition-all active:scale-95 cursor-pointer"
            >
              配置批改策略
            </button>
          </div>
          {/* Subtle background visual pattern */}
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-4 translate-y-4">
            <BookOpen className="w-56 h-56 text-emerald-800" />
          </div>
        </div>

        {/* Feature Classroom Access */}
        <div className="w-full lg:w-[340px] glass-panel rounded-3xl p-6 flex flex-col justify-between border-emerald-500/20 dark:border-emerald-500/10 relative overflow-hidden bg-gradient-to-br from-emerald-600/10 via-transparent to-transparent">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">特色页面</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 pt-2">
              进入虚拟教室
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              通过 2D/3D 固定视角，直观浏览班级学生座位排布与最新学习状态警报，实时关注班级氛围。
            </p>
          </div>
          <button 
            id="wb-enter-classroom"
            onClick={() => onEnterClass(selectedClassId)}
            className="mt-6 w-full py-3 bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 cursor-pointer"
          >
            进入教室
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Pending Tasks VS Alerts Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Pending Tasks Panel */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-emerald-600 dark:bg-emerald-500 rounded-full"></span>
              待处理教学任务
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              当前进行中：{pendingTasks.length} 项
            </span>
          </div>

          <div className="space-y-3">
            {pendingTasks.map(task => (
              <div 
                key={task.id}
                id={`task-card-${task.id}`}
                className="glass-panel glass-panel-hover rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-l-emerald-600 dark:border-l-emerald-500"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800/60 mt-0.5">
                    {getNodeIcon(task.node)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                        {task.name}
                      </h4>
                      <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 rounded-md">
                        {task.className}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        截止：{task.deadline}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        当前节点：<span className="font-medium text-emerald-700 dark:text-emerald-400">{task.nodeName}</span>
                      </span>
                    </div>
                    {task.progress !== undefined && (
                      <div className="w-48 mt-1">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                          <span>处理进度</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${task.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  {getStatusBadge(task.status)}
                  <button
                    onClick={() => onTriggerTask(task)}
                    className="px-3.5 py-1.5 bg-emerald-700/10 hover:bg-emerald-700 hover:text-white dark:bg-emerald-500/10 dark:hover:bg-emerald-500 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-lg transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    去处理
                  </button>
                </div>
              </div>
            ))}

            {pendingTasks.length === 0 && (
              <div className="glass-panel rounded-2xl p-8 text-center text-slate-500">
                <p>今日暂无待处理任务，您可以合理安排备课时间。</p>
              </div>
            )}
          </div>

          {/* Recently Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="pt-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">最近完成任务</h3>
              {completedTasks.map(task => (
                <div 
                  key={task.id}
                  className="glass-panel rounded-2xl p-4 flex items-center justify-between opacity-70 border-l-4 border-l-slate-300 dark:border-l-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800/40">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">{task.name}</h4>
                      <p className="text-[11px] text-slate-400">{task.className} · 已同步至学情分析</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-md font-medium">已归档</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Alerts & Daily schedule */}
        <div className="space-y-6">
          
          {/* Today's Schedule & Reminders */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                今日日程
              </h3>
              <button
                onClick={() => onNavigate('schedule')}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
              >
                查看课表日程
              </button>
            </div>

            <div className="rounded-[22px] bg-white/65 dark:bg-zinc-900/45 border border-slate-200/70 dark:border-zinc-800/80 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Today</p>
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-50">7月3日 周五</h4>
                </div>
                <span className="px-2 py-1 rounded-full bg-slate-100/80 dark:bg-zinc-800/80 text-[11px] font-bold text-slate-500 dark:text-slate-300">
                  {todaySchedule.length + activeReminders.length} 项
                </span>
              </div>

              <div className="space-y-2">
                {todaySchedule.map(sch => (
                  <div key={sch.id} className="grid grid-cols-[64px_1fr] gap-3 items-start">
                    <p className="pt-2 text-[11px] font-mono font-black text-slate-500 dark:text-slate-400">{sch.time.split(' - ')[0]}</p>
                    <div className={`rounded-2xl bg-slate-50/80 dark:bg-zinc-800/70 border border-slate-200/70 dark:border-zinc-700/70 p-3 border-l-4 ${
                      sch.type === 'class' ? 'border-l-emerald-500' : sch.type === 'research' ? 'border-l-blue-500' : 'border-l-slate-400'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{sch.title}</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5">{sch.className} · {sch.time}</p>
                        </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        sch.type === 'class' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
                        sch.type === 'research' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' :
                        'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300'
                      }`}>
                        {sch.type === 'class' ? '授课' : sch.type === 'research' ? '教研' : '日程'}
                      </span>
                      </div>
                    </div>
                  </div>
                ))}

                {activeReminders.slice(0, 2).map(rem => (
                  <div key={rem.id} className="grid grid-cols-[64px_1fr] gap-3 items-start">
                    <p className="pt-2 text-[11px] font-mono font-black text-amber-700 dark:text-amber-400">{rem.time}</p>
                    <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-900/40 border-l-4 border-l-amber-500 p-3">
                      <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{rem.name}</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5">收作业提醒 · {rem.className}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Student Alerts & Risks */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
              学情异常与关注
            </h3>

            <div className="space-y-3">
              {/* Critical Risks */}
              {riskStudents.map(student => (
                <div 
                  key={student.id} 
                  onClick={() => onNavigate('diagnosis', 'profile')}
                  className="p-3 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 cursor-pointer transition-all flex items-start gap-2.5"
                >
                  <UserMinus className="w-4 h-4 text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{student.name}</span>
                      <span className="px-1.5 py-0.5 text-[9px] bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 rounded-md font-medium">近期风险</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      最近作业：连续三次下降 ({student.recentHomeworkTrend[student.recentHomeworkTrend.length - 1]}分)
                    </p>
                    {student.familyStatusTag && (
                      <span className="inline-block text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-500 px-1.5 py-0.2 rounded mt-1">
                        家校标签：{student.familyStatusTag}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Warnings */}
              {warningStudents.slice(0, 1).map(student => (
                <div 
                  key={student.id} 
                  onClick={() => onNavigate('diagnosis', 'profile')}
                  className="p-3 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 cursor-pointer transition-all flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{student.name}</span>
                      <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded-md font-medium">需要关注</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      薄弱环节：{student.weakKnowledge.join('、')}
                    </p>
                  </div>
                </div>
              ))}

              {/* Outstanding students to balance the mood */}
              {outstandingStudents.slice(0, 1).map(student => (
                <div 
                  key={student.id} 
                  onClick={() => onNavigate('diagnosis', 'profile')}
                  className="p-3 rounded-xl bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 cursor-pointer transition-all flex items-start gap-2.5"
                >
                  <Award className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{student.name}</span>
                      <span className="px-1.5 py-0.5 text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded-md font-medium">表现突出</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      课堂观察：{student.behaviorTags.slice(0, 2).join('、')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
