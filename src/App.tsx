/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import AppLayout from './app/AppLayout';
import { createNavGroups, PageId } from './app/navigation';

// Import Types and Mock Data
import {
  Student, SchoolClass, WorkbenchTask, ScheduleItem,
  TimerReminder, ReviewItem, WorkflowState, TeacherObservation, RosterStudent
} from './domain/types';
import {
  initialTasks,
  initialSchedule, initialReminders, initialReviewQueue, initialWorkflowState,
  initialKnowledgeNodes
} from './domain/mockData';
import { createEmptyWorkflowState } from './domain/gradingTask';
import {
  createRosterClass,
  createRosterStudent,
  deleteRosterStudent,
  getRoster,
  importRosterStudents,
  toggleRosterClassArchive,
  updateRosterClass,
  updateRosterStudent
} from './services/rosterApi';

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

const AI_GRADING_TEST_TASK_ID = 'task-20260810-1';

const describeRosterError = (error: unknown) => {
  const code = error instanceof Error ? error.message : '未知错误';
  if (code === 'DUPLICATE_STUDENT_NO') return '该班级中已存在相同学号';
  if (code === 'DUPLICATE_CLASS') return '同一学期已存在同名班级';
  if (code === 'CLASS_NOT_FOUND') return '目标班级不存在';
  return code;
};

const getLocalDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createInitialWorkflowState = (task: WorkbenchTask) => {
  if (task.id === AI_GRADING_TEST_TASK_ID) {
    const state = createEmptyWorkflowState(task);
    return { ...state, assignment: { ...state.assignment, status: 'assigned' as const } };
  }
  return {
    ...initialWorkflowState,
    taskName: task.name,
    classId: task.classId,
    deadline: task.deadline
  };
};

export default function App() {
  // Navigation & View State
  const [activePage, setActivePage] = useState<PageId>('workbench');
  const [selectedClassId, setSelectedClassId] = useState<string>('c5');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [lowConfidenceThreshold, setLowConfidenceThreshold] = useState<number>(0.75);
  const [ocrHumanReviewThreshold, setOcrHumanReviewThreshold] = useState<number>(0.70);
  const [ocrAutoPassThreshold, setOcrAutoPassThreshold] = useState<number>(0.90);
  const [libraryMode, setLibraryMode] = useState<'graph' | 'editor'>('graph');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    teaching: true,
    homeSchool: true,
    career: false,
    library: true
  });

  // Class and student state is hydrated from the authoritative roster service.
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<WorkbenchTask[]>(initialTasks);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialSchedule);
  const [reminders, setReminders] = useState<TimerReminder[]>(initialReminders);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>(initialReviewQueue);
  const [workflowStates, setWorkflowStates] = useState<Record<string, WorkflowState>>(() => Object.fromEntries(
    initialTasks.map(task => [task.id, createInitialWorkflowState(task)])
  ));

  // Toast notifications state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const loadRoster = async () => {
    setRosterLoading(true);
    setRosterError(null);
    try {
      const snapshot = await getRoster();
      setClasses(snapshot.classes);
      setStudents(snapshot.students);
      const preferredClass = snapshot.classes.find(item => item.id === 'c5' && item.status === 'active')
        ?? snapshot.classes.find(item => item.status === 'active');
      if (preferredClass) setSelectedClassId(preferredClass.id);
      if (snapshot.students.length) setSelectedStudentId(snapshot.students[0].id);
    } catch (error) {
      setRosterError(error instanceof Error ? error.message : 'ROSTER_LOAD_FAILED');
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    void loadRoster();
  }, []);

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
  const handleAddClass = async (newClass: SchoolClass) => {
    try {
      const created = await createRosterClass(newClass);
      setClasses(current => [...current, created]);
      triggerToast(`成功新建了班级 [${created.name}]！`);
    } catch (error) {
      triggerToast(`班级创建失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleUpdateClass = async (updated: SchoolClass) => {
    try {
      await updateRosterClass(updated);
      const snapshot = await getRoster();
      setClasses(snapshot.classes);
      setStudents(snapshot.students);
      triggerToast('班级基础信息已成功更新！');
    } catch (error) {
      triggerToast(`班级保存失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleArchiveClass = async (classId: string) => {
    try {
      const saved = await toggleRosterClassArchive(classId);
      setClasses(current => current.map(item => item.id === saved.id ? saved : item));
      triggerToast(saved.status === 'archived' ? '该班级已归档。' : '该班级已取消归档。');
    } catch (error) {
      triggerToast(`班级状态更新失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 5. Student actions
  const handleAddStudent = async (newStudent: Student) => {
    try {
      const created = await createRosterStudent(newStudent);
      setStudents(current => [created, ...current]);
      setClasses(current => current.map(item => item.id === created.classId
        ? {
            ...item,
            studentCount: item.studentCount + 1,
            representatives: created.isRepresentative
              ? [...new Set([...item.representatives, created.id])]
              : item.representatives
          }
        : item));
      setSelectedStudentId(created.id);
      triggerToast(`已成功新建 [${created.name}] 的学生档案。`);
      return true;
    } catch (error) {
      triggerToast(`学生保存失败：${describeRosterError(error)}`);
      return false;
    }
  };

  const handleUpdateStudent = async (updated: Student) => {
    try {
      await updateRosterStudent(updated);
      const snapshot = await getRoster();
      setClasses(snapshot.classes);
      setStudents(snapshot.students);
      triggerToast(`学生 [${updated.name}] 的档案资料修改保存成功！`);
      return true;
    } catch (error) {
      triggerToast(`学生保存失败：${describeRosterError(error)}`);
      return false;
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      await deleteRosterStudent(studentId);
      const snapshot = await getRoster();
      setClasses(snapshot.classes);
      setStudents(snapshot.students);
      triggerToast('学生已从当前班级名册移出。');
    } catch (error) {
      triggerToast(`学生移出失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleBulkImport = async (classId: string, rows: { studentNo: string; name: string; gender?: 'male' | 'female' }[]) => {
    const result = await importRosterStudents(classId, rows);
    const snapshot = await getRoster();
    setClasses(snapshot.classes);
    setStudents(snapshot.students);
    return result;
  };

  const handleBulkMoveClass = async (studentIds: string[], targetClassId: string) => {
    const targetClass = classes.find(c => c.id === targetClassId);
    if (!targetClass) return;
    try {
      const selected = students.filter(item => studentIds.includes(item.id));
      await Promise.all(selected.map(student => updateRosterStudent({
        ...student,
        classId: targetClassId,
        className: targetClass.name,
        isRepresentative: false
      })));
      const snapshot = await getRoster();
      setClasses(snapshot.classes);
      setStudents(snapshot.students);
      triggerToast(`成功将选中的 ${studentIds.length} 名学生批量调入到 [${targetClass.name}]！`);
    } catch (error) {
      triggerToast(`批量调班失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleBulkAddTags = async (studentIds: string[], newTags: string[]) => {
    try {
      const selected = students.filter(item => studentIds.includes(item.id));
      const saved = await Promise.all(selected.map(student => updateRosterStudent({
        ...student,
        behaviorTags: Array.from(new Set([...student.behaviorTags, ...newTags]))
      })));
      const savedById = new Map(saved.map(item => [item.id, item]));
      setStudents(current => current.map(item => savedById.get(item.id) ?? item));
      triggerToast(`成功为 ${studentIds.length} 名学生批量添加了标签：${newTags.join(', ')}`);
    } catch (error) {
      triggerToast(`批量标签保存失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 6. Observation Note addition
  const persistObservation = async (studentId: string, note: TeacherObservation) => {
    const student = students.find(item => item.id === studentId);
    if (!student) throw new Error('STUDENT_NOT_FOUND');
    const saved = await updateRosterStudent({
      ...student,
      observationHistory: [note, ...student.observationHistory]
    });
    setStudents(current => current.map(item => item.id === studentId ? saved : item));
  };

  const handleAddObservation = (studentId: string, note: TeacherObservation) => {
    setStudents(current => current.map(student => student.id === studentId
      ? { ...student, observationHistory: [note, ...student.observationHistory] }
      : student));
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
  const handleSyncToProfiles = (aiResults: WorkflowState['aiResults']) => {
    // Simulate updating students' recent scores & diagnostic status
    setStudents(students.map(s => {
      const match = aiResults.find(r => r.studentName === s.name);
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

  if (rosterLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-500">
        正在加载班级与学生名册...
      </div>
    );
  }

  if (rosterError) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-3 text-slate-600">
        <p className="text-sm font-semibold">名册服务暂时不可用（{rosterError}）</p>
        <button
          type="button"
          onClick={() => void loadRoster()}
          className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold"
        >
          重新连接
        </button>
      </div>
    );
  }

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
                return persistObservation(studentId, {
                  date: getLocalDate(),
                  type: 'neutral',
                  category: 'behavior',
                  content: text,
                  author: '王老师'
                });
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
              defaultClassId={selectedClassId}
              workflowStates={workflowStates}
              knowledgeNodes={initialKnowledgeNodes}
              reviewQueue={reviewQueue}
              lowConfidenceThreshold={lowConfidenceThreshold}
              ocrHumanReviewThreshold={ocrHumanReviewThreshold}
              ocrAutoPassThreshold={ocrAutoPassThreshold}
              onCreateTask={(task) => {
                setTasks(current => [task, ...current]);
                setWorkflowStates(current => ({ ...current, [task.id]: createEmptyWorkflowState(task) }));
                triggerToast('批改任务已创建，可进入作业工作流继续配置');
              }}
              onEnterWorkflow={(task) => {
                setSelectedClassId(task.classId);
              }}
              onSelectTask={(task) => {
                setSelectedClassId(task.classId);
              }}
              onUpdateTask={(updatedTask) => setTasks(current => current.map(task => task.id === updatedTask.id ? updatedTask : task))}
              onUpdateState={(taskId, updated) => setWorkflowStates(current => ({
                ...current,
                [taskId]: { ...current[taskId], ...updated }
              }))}
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
              ocrHumanReviewThreshold={ocrHumanReviewThreshold}
              ocrAutoPassThreshold={ocrAutoPassThreshold}
              onUpdateOcrThresholds={(humanReview, autoPass) => {
                setOcrHumanReviewThreshold(humanReview);
                setOcrAutoPassThreshold(autoPass);
              }}
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

