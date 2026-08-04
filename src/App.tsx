/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import AppLayout from './app/AppLayout';
import { createNavGroups, PageId } from './app/navigation';

// Import Types and Mock Data
import { 
  Student, SchoolClass, WorkbenchTask, ScheduleItem, 
  TimerReminder, ReviewItem, WorkflowState, TeacherObservation 
} from './domain/types';
import { 
  initialClasses, initialStudents, initialTasks, 
  initialSchedule, initialReminders, initialReviewQueue, initialWorkflowState,
  initialKnowledgeNodes
} from './domain/mockData';

// Import Custom Sub-Components
import Workbench from './features/workbench/Workbench';
import VirtualClassroom from './features/classroom/VirtualClassroom';
import ClassManagement from './features/classes/ClassManagement';
import StudentManagement from './features/students/StudentManagement';
import ScheduleReminder from './features/schedule/ScheduleReminder';
import SystemSettings from './features/settings/SystemSettingsPanel';
import KnowledgeLibrary from './features/knowledge/KnowledgeLibrary';
import TagManagement from './features/tags/TagManagement';
import LessonPlanWorkspace from './features/lesson-plan/LessonPlanWorkspace';
import GradingWorkspace from './features/grading/GradingWorkspace';
import DiagnosisWorkspace from './features/diagnosis/DiagnosisWorkspace';
import CareerPlaceholder from './features/career/CareerPlaceholder';

export default function App() {
  // Navigation & View State
  const [activePage, setActivePage] = useState<PageId>('workbench');
  const [selectedClassId, setSelectedClassId] = useState<string>('c1');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('s1');
  const [lowConfidenceThreshold, setLowConfidenceThreshold] = useState<number>(0.75);
  const [libraryMode, setLibraryMode] = useState<'graph' | 'editor'>('graph');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    teaching: true,
    homeSchool: true,
    career: false,
    library: true
  });

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
    setClasses(classes.map(c => c.id === classId ? { ...c, status: c.status === 'active' ? 'archived' as any : 'active' as any } : c));
    const target = classes.find(c => c.id === classId);
    triggerToast(target?.status === 'active' ? '该班级已归档。' : '该班级已取消归档。');
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
    if (pageId === 'grading-flow' || pageId === 'grading-tasks' || pageId === 'review-queue') {
      setActivePage('grading-workspace');
      return;
    }
    if (pageId === 'diagnosis' || pageId === 'profile') {
      if (subPageId === 'profile' || pageId === 'profile') {
        const riskStudent = students.find(s => s.status === 'risk');
        if (riskStudent) {
          setSelectedStudentId(riskStudent.id);
        }
      }
      setActivePage('diagnosis-workspace');
      return;
    }
    setActivePage(pageId as PageId);
    if (pageId === 'library' && subPageId === 'editor') {
      setLibraryMode('editor');
      setActivePage('library-editor');
    }
    if (pageId === 'library' && subPageId === 'graph') {
      setLibraryMode('graph');
      setActivePage('knowledge-graph');
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const selectedClass = classes.find(c => c.id === selectedClassId) ?? classes[0];
  const pendingReviewCount = reviewQueue.filter(r => r.status === 'pending').length;
  const navGroups = createNavGroups(pendingReviewCount);

  return (
    <AppLayout
      activePage={activePage}
      classes={classes}
      expandedGroups={expandedGroups}
      navGroups={navGroups}
      pendingReviewCount={pendingReviewCount}
      selectedClass={selectedClass}
      selectedClassId={selectedClassId}
      showToast={showToast}
      toastMessage={toastMessage}
      onSelectClass={setSelectedClassId}
      onSelectPage={setActivePage}
      onToggleGroup={toggleGroup}
    >
      {/* Page Router */}
          {activePage === 'workbench' && (
            <Workbench
              tasks={tasks}
              classes={classes}
              students={students}
              schedule={schedule}
              reminders={reminders}
              selectedClassId={selectedClassId}
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
                handleNavigate('grading-workspace');
              }}
            />
          )}

          {activePage === 'lesson-plan' && (
            <LessonPlanWorkspace onShowToast={triggerToast} />
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

          {activePage === 'grading-workspace' && (
            <GradingWorkspace
              tasks={tasks}
              classes={classes}
              workflowState={workflowState}
              reviewQueue={reviewQueue}
              lowConfidenceThreshold={lowConfidenceThreshold}
              onCreateTask={(task) => {
                setTasks([task, ...tasks]);
                triggerToast('批改任务已创建，可进入作业工作流继续配置');
              }}
              onEnterWorkflow={(task) => {
                setWorkflowState({
                  ...workflowState,
                  taskName: task.name,
                  classId: task.classId,
                  deadline: task.deadline
                });
                setSelectedClassId(task.classId);
              }}
              onSelectTask={(task) => {
                setWorkflowState({
                  ...workflowState,
                  taskName: task.name,
                  classId: task.classId,
                  deadline: task.deadline
                });
                setSelectedClassId(task.classId);
              }}
              onUpdateState={(updated) => setWorkflowState({ ...workflowState, ...updated })}
              onSyncToProfiles={handleSyncToProfiles}
              onConfirmReview={handleConfirmReview}
              onBounceToOcr={handleBounceToOcr}
              onMarkAsSample={handleMarkAsSample}
              onShowToast={triggerToast}
            />
          )}

          {activePage === 'diagnosis-workspace' && (
            <DiagnosisWorkspace
              students={students}
              classes={classes}
              selectedClassId={selectedClassId}
              selectedStudentId={selectedStudentId}
              onSelectClass={setSelectedClassId}
              onSelectStudent={setSelectedStudentId}
              onEditStudent={(studentId) => {
                setSelectedStudentId(studentId);
                setActivePage('student-mgmt');
                triggerToast('已跳转到学生管理，请在列表中编辑该学生档案');
              }}
              onAddObservation={handleAddObservation}
              onNavigate={handleNavigate}
              onShowToast={triggerToast}
            />
          )}

          {(activePage === 'knowledge-graph' || activePage === 'library-editor') && (
            <KnowledgeLibrary
              nodes={initialKnowledgeNodes}
              mode={activePage === 'library-editor' ? 'editor' : libraryMode}
              onSwitchMode={(mode) => {
                setLibraryMode(mode);
                setActivePage(mode === 'graph' ? 'knowledge-graph' : 'library-editor');
              }}
              onShowToast={triggerToast}
            />
          )}

          {activePage === 'tag-mgmt' && (
            <TagManagement onShowToast={triggerToast} />
          )}

          {activePage === 'settings' && (
            <SystemSettings
              lowConfidenceThreshold={lowConfidenceThreshold}
              onUpdateThreshold={setLowConfidenceThreshold}
              classes={classes}
              selectedClassId={selectedClassId}
              onSelectClass={setSelectedClassId}
              onShowToast={triggerToast}
            />
          )}

          {activePage === 'career-open-class' && (
            <CareerPlaceholder
              title="公开课"
              description="未来用于整理公开课选题、教学设计、磨课记录和展示材料。"
              onShowToast={triggerToast}
            />
          )}

          {activePage === 'career-competition' && (
            <CareerPlaceholder
              title="教学比赛"
              description="未来用于管理参赛任务、材料清单、课例打磨和评审反馈。"
              onShowToast={triggerToast}
            />
          )}

          {activePage === 'career-paper' && (
            <CareerPlaceholder
              title="论文课题"
              description="未来用于沉淀教学案例、研究问题、论文草稿和课题过程材料。"
              onShowToast={triggerToast}
            />
          )}

          {activePage === 'career-title' && (
            <CareerPlaceholder
              title="职称材料"
              description="未来用于汇总成果证明、公开课记录、论文课题和教学反思材料。"
              onShowToast={triggerToast}
            />
          )}

    </AppLayout>
  );
}

