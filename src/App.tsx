/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Sparkles, LayoutDashboard, Grid, FolderOpen, Users, Calendar, 
  Workflow, CheckSquare, BarChart3, UserSquare2, Sliders, Bell, HelpCircle, Sun, Moon 
} from 'lucide-react';

// Import Types and Mock Data
import { 
  Student, SchoolClass, WorkbenchTask, ScheduleItem, 
  TimerReminder, ReviewItem, WorkflowState, TeacherObservation 
} from './types';
import { 
  initialClasses, initialStudents, initialTasks, 
  initialSchedule, initialReminders, initialReviewQueue, initialWorkflowState 
} from './mockData';

// Import Custom Sub-Components
import Workbench from './components/Workbench';
import VirtualClassroom from './components/VirtualClassroom';
import ClassManagement from './components/ClassManagement';
import StudentManagement from './components/StudentManagement';
import ScheduleReminder from './components/ScheduleReminder';
import GradingWorkflow from './components/GradingWorkflow';
import ReviewQueuePage from './components/ReviewQueuePage';
import ClassDiagnosis from './components/ClassDiagnosis';
import StudentProfile from './components/StudentProfile';
import SystemSettings from './components/SystemSettings';

export default function App() {
  // Navigation & View State
  const [activePage, setActivePage] = useState<string>('workbench');
  const [selectedClassId, setSelectedClassId] = useState<string>('c1');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('s1');
  const [lowConfidenceThreshold, setLowConfidenceThreshold] = useState<number>(0.75);

  // Core App States (simulating cloud database persistence with local states)
  const [classes, setClasses] = useState<SchoolClass[]>(initialClasses);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [tasks, setTasks] = useState<WorkbenchTask[]>(initialTasks);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialSchedule);
  const [reminders, setReminders] = useState<TimerReminder[]>(initialReminders);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>(initialReviewQueue);
  const [workflowState, setWorkflowState] = useState<WorkflowState>(initialWorkflowState);

  // Toast notifications state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Trigger Toast helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  // State Handlers
  // 1. Task Completed toggle in Workbench
  const handleToggleTask = (taskId: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t));
    triggerToast('任务状态更新成功！');
  };

  // 2. Schedule Item edit/addition
  const handleAddScheduleItem = (item: ScheduleItem) => {
    setSchedule([...schedule, item]);
    triggerToast('成功添加排课计划/行事日程！');
  };

  const handleUpdateScheduleItem = (updated: ScheduleItem) => {
    setSchedule(schedule.map(s => s.id === updated.id ? updated : s));
    triggerToast('排课计划已成功更新！');
  };

  const handleDeleteScheduleItem = (itemId: string) => {
    setSchedule(schedule.filter(s => s.id !== itemId));
    triggerToast('已成功移除此日程事件。');
  };

  // 3. Reminders list toggles
  const handleAddReminder = (reminder: TimerReminder) => {
    setReminders([...reminders, reminder]);
    triggerToast(`⏰ 定时作业提醒 [${reminder.name}] 已成功创建！`);
  };

  const handleToggleReminderStatus = (reminderId: string) => {
    setReminders(reminders.map(r => r.id === reminderId ? { ...r, status: r.status === 'active' ? 'inactive' : 'active' } : r));
    triggerToast('定时提醒开关已切换！');
  };

  const handleDeleteReminder = (reminderId: string) => {
    setReminders(reminders.filter(r => r.id !== reminderId));
    triggerToast('已删除此条定时提醒。');
  };

  // 4. Class actions
  const handleAddClass = (newClass: SchoolClass) => {
    setClasses([...classes, newClass]);
    triggerToast(`🏫 成功新建了班级 [${newClass.name}]！`);
  };

  const handleUpdateClass = (updated: SchoolClass) => {
    setClasses(classes.map(c => c.id === updated.id ? updated : c));
    triggerToast('班级基础信息已成功更新！');
  };

  const handleArchiveClass = (classId: string) => {
    setClasses(classes.map(c => c.id === classId ? { ...c, status: 'archived' as any } : c));
    triggerToast('该班级已成功归档并冻结其课程与学生档案数据。');
  };

  // 5. Student actions
  const handleAddStudent = (newStudent: Student) => {
    setStudents([...students, newStudent]);
    triggerToast(`👤 已成功新建 [${newStudent.name}] 的专属学情电子档案。`);
  };

  const handleUpdateStudent = (updated: Student) => {
    setStudents(students.map(s => s.id === updated.id ? updated : s));
    triggerToast(`学生 [${updated.name}] 的档案资料修改保存成功！`);
  };

  const handleDeleteStudent = (studentId: string) => {
    setStudents(students.filter(s => s.id !== studentId));
    triggerToast('学生记录已成功删除。');
  };

  const handleBulkImport = (imported: Student[]) => {
    setStudents([...students, ...imported]);
    // Also trigger toast from caller as needed
  };

  const handleBulkMoveClass = (studentIds: string[], targetClassId: string) => {
    const targetClass = classes.find(c => c.id === targetClassId);
    if (!targetClass) return;

    setStudents(students.map(s => {
      if (studentIds.includes(s.id)) {
        return {
          ...s,
          classId: targetClassId,
          className: targetClass.name
        };
      }
      return s;
    }));
    triggerToast(`成功将选中的 ${studentIds.length} 名学生批量调入到 [${targetClass.name}]！`);
  };

  const handleBulkAddTags = (studentIds: string[], newTags: string[]) => {
    setStudents(students.map(s => {
      if (studentIds.includes(s.id)) {
        return {
          ...s,
          behaviorTags: Array.from(new Set([...s.behaviorTags, ...newTags]))
        };
      }
      return s;
    }));
    triggerToast(`成功为 ${studentIds.length} 名学生批量添加了标签：${newTags.join(', ')}`);
  };

  // 6. Observation Note addition
  const handleAddObservation = (studentId: string, note: TeacherObservation) => {
    setStudents(students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          observationHistory: [note, ...s.observationHistory]
        };
      }
      return s;
    }));
  };

  // 7. Review Queue Actions
  const handleConfirmReview = (reviewId: string, finalScore: number, changeReason: string) => {
    setReviewQueue(reviewQueue.map(r => {
      if (r.id === reviewId) {
        return {
          ...r,
          status: 'completed' as any,
          teacherFinalScore: finalScore,
          discrepancyReason: changeReason
        };
      }
      return r;
    }));
  };

  const handleBounceToOcr = (reviewId: string) => {
    setReviewQueue(reviewQueue.filter(r => r.id !== reviewId));
    // Bounce simulation
  };

  const handleMarkAsSample = (studentName: string) => {
    // Simulated logic: add a behavior tag or status for demonstration
    setStudents(students.map(s => {
      if (s.name === studentName) {
        return {
          ...s,
          behaviorTags: Array.from(new Set([...s.behaviorTags, '优秀讲评样例']))
        };
      }
      return s;
    }));
  };

  // Sync Profiles action from Grading step 10
  const handleSyncToProfiles = () => {
    // Simulate updating students' recent scores & diagnostic status
    setStudents(students.map(s => {
      const match = workflowState.aiResults.find(r => r.studentName === s.name);
      if (match) {
        const updatedScores = [...s.recentHomeworkTrend.slice(1), match.score];
        const updatedStatus = match.score < 80 ? ('warning' as const) : (match.score >= 90 ? ('outstanding' as const) : ('good' as const));
        return {
          ...s,
          recentHomeworkTrend: updatedScores,
          status: updatedStatus,
          behaviorTags: Array.from(new Set([...s.behaviorTags, match.score >= 90 ? '现代文拔尖' : '标题考点需精进']))
        };
      }
      return s;
    }));
  };

  // Page Routing Navigation
  const handleNavigate = (pageId: string, subPageId?: string) => {
    setActivePage(pageId);
    if (pageId === 'diagnosis' && subPageId === 'profile') {
      // Find the first risk student if any to display on profile
      const riskStudent = students.find(s => s.status === 'risk');
      if (riskStudent) {
        setSelectedStudentId(riskStudent.id);
      }
      setActivePage('profile');
    }
  };

  // Navigation items specification
  const sidebarItems = [
    { id: 'workbench', label: '我的工作台', icon: LayoutDashboard },
    { id: 'classroom', label: '虚拟教室视图', icon: Grid },
    { id: 'class-mgmt', label: '授课班级管理', icon: FolderOpen },
    { id: 'student-mgmt', label: '学生档案管理', icon: Users },
    { id: 'schedule', label: '教学行事与排课', icon: Calendar },
    { id: 'grading-flow', label: '作业批改工作流', icon: Workflow },
    { id: 'review-queue', label: '置信复核队列', icon: CheckSquare },
    { id: 'diagnosis', label: '班级学情诊断', icon: BarChart3 },
    { id: 'profile', label: '学生电子画像', icon: UserSquare2 },
    { id: 'settings', label: '智能辅助设置', icon: Sliders }
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col antialiased">
      
      {/* Universal header */}
      <header className="h-16 bg-white dark:bg-zinc-900 border-b border-slate-150 dark:border-zinc-800/80 px-6 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-700 dark:bg-emerald-600 flex items-center justify-center text-white shadow shadow-emerald-700/10">
            <Sparkles className="w-5.5 h-5.5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              教师 AI 助手 
              <span className="text-[10px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded-full border border-emerald-500/10">
                PRO v1.5
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">面向初中语文教师的教学证据采集、作业 AI 批改、学情诊断和学生画像平台</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          
          {/* Active Class Dropdown for quick sync */}
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">当前焦点：</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-zinc-800 border rounded-xl text-xs font-semibold cursor-pointer text-slate-600 dark:text-slate-200"
            >
              {classes.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-slate-200"></div>

          {/* User profile details info */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">王王老师 (初一语文)</span>
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
              王
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Vertical sidebar */}
        <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-slate-150 dark:border-zinc-800/80 flex flex-col justify-between p-4 flex-shrink-0 select-none z-20">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-3 block mb-2">主导航菜单</span>
            <nav className="space-y-1">
              {sidebarItems.map(item => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-item-${item.id}`}
                    onClick={() => setActivePage(item.id)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-emerald-700 text-white dark:bg-emerald-600 shadow-md shadow-emerald-700/10' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:hover:bg-zinc-850 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4.5 h-4.5" />
                      <span>{item.label}</span>
                    </div>
                    {/* Badge numbers for Review & Alerts */}
                    {item.id === 'review-queue' && reviewQueue.filter(r => r.status === 'pending').length > 0 && (
                      <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-bold ${isActive ? 'bg-white text-emerald-800' : 'bg-red-500 text-white'}`}>
                        {reviewQueue.filter(r => r.status === 'pending').length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick help context / documentation footer */}
          <div className="p-3 bg-slate-50 dark:bg-zinc-850/40 rounded-2xl border border-slate-150 dark:border-zinc-800/60 text-[11px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              语文教研协作区
            </span>
            <p className="leading-normal">部编版初中语文名家名篇知识要点、自适应巩固微课已在后台全量就绪。可直接在[学生电子画像]中给特定孩子一键定制推送。</p>
          </div>
        </aside>

        {/* Workspace content wrapper */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-zinc-950">
          
          {/* Page Router */}
          {activePage === 'workbench' && (
            <Workbench
              tasks={tasks}
              classes={classes}
              students={students}
              schedule={schedule}
              reminders={reminders}
              onNavigate={handleNavigate}
              onEnterClass={(classId) => {
                setSelectedClassId(classId);
                handleNavigate('classroom');
              }}
              onSelectTask={(taskId) => {
                handleToggleTask(taskId);
              }}
              onTriggerTask={(task) => {
                setWorkflowState({
                  ...workflowState,
                  taskName: task.name,
                  classId: task.classId,
                  deadline: task.deadline
                });
                handleNavigate('grading-flow');
              }}
            />
          )}

          {activePage === 'classroom' && (
            <VirtualClassroom
              students={students}
              classes={classes}
              selectedClassId={selectedClassId}
              onSelectClass={setSelectedClassId}
              onNavigate={handleNavigate}
              onViewStudentProfile={(studentId) => {
                setSelectedStudentId(studentId);
                handleNavigate('profile');
              }}
              onAddObservation={(studentId, text) => {
                handleAddObservation(studentId, {
                  date: '2026-07-02',
                  type: 'neutral',
                  category: 'behavior',
                  content: text,
                  author: '王王老师'
                });
              }}
              onSetStudentReminder={(studentId, name) => {
                const s = students.find(stud => stud.id === studentId);
                triggerToast(`⏰ 成功为 [${s ? s.name : '学生'}] 创建了个性化督促提醒：${name}`);
              }}
            />
          )}

          {activePage === 'class-mgmt' && (
            <ClassManagement
              classes={classes}
              students={students}
              onAddClass={handleAddClass}
              onUpdateClass={handleUpdateClass}
              onArchiveClass={handleArchiveClass}
              onEnterClassroom={(classId) => {
                setSelectedClassId(classId);
                handleNavigate('classroom');
              }}
            />
          )}

          {activePage === 'student-mgmt' && (
            <StudentManagement
              students={students}
              classes={classes}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onBulkImport={handleBulkImport}
              onBulkMoveClass={handleBulkMoveClass}
              onBulkAddTags={handleBulkAddTags}
            />
          )}

          {activePage === 'schedule' && (
            <ScheduleReminder
              schedule={schedule}
              reminders={reminders}
              classes={classes}
              onAddScheduleItem={handleAddScheduleItem}
              onUpdateScheduleItem={handleUpdateScheduleItem}
              onDeleteScheduleItem={handleDeleteScheduleItem}
              onAddReminder={handleAddReminder}
              onToggleReminderStatus={handleToggleReminderStatus}
              onDeleteReminder={handleDeleteReminder}
            />
          )}

          {activePage === 'grading-flow' && (
            <GradingWorkflow
              workflowState={workflowState}
              classes={classes}
              onUpdateState={(updated) => setWorkflowState({ ...workflowState, ...updated })}
              onSyncToProfiles={handleSyncToProfiles}
              onShowToast={triggerToast}
              lowConfidenceThreshold={lowConfidenceThreshold}
            />
          )}

          {activePage === 'review-queue' && (
            <ReviewQueuePage
              reviewQueue={reviewQueue}
              onConfirmReview={handleConfirmReview}
              onBounceToOcr={handleBounceToOcr}
              onMarkAsSample={handleMarkAsSample}
              onShowToast={triggerToast}
            />
          )}

          {activePage === 'diagnosis' && (
            <ClassDiagnosis
              students={students}
              classes={classes}
              selectedClassId={selectedClassId}
              onSelectClass={setSelectedClassId}
              onNavigate={handleNavigate}
              onShowToast={triggerToast}
            />
          )}

          {activePage === 'profile' && (
            <StudentProfile
              students={students}
              classes={classes}
              selectedStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
              onAddObservation={handleAddObservation}
              onShowToast={triggerToast}
            />
          )}

          {activePage === 'settings' && (
            <SystemSettings
              lowConfidenceThreshold={lowConfidenceThreshold}
              onUpdateThreshold={setLowConfidenceThreshold}
              onShowToast={triggerToast}
            />
          )}

        </main>

      </div>

      {/* Universal feedback Toast panel */}
      {showToast && (
        <div className="fixed top-4 right-4 bg-slate-900/90 dark:bg-zinc-900/90 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-50 border border-slate-700/50 animate-fade-in">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
