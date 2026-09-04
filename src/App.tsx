/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import AppLayout from './app/AppLayout';
import { createNavGroups, PageId } from './app/navigation';

// Import Types and Mock Data
import {
  Student, SchoolClass, WorkbenchTask, ScheduleItem, SchedulePeriod,
  TimerReminder, ReviewItem, WorkflowState, TeacherObservation, RosterStudent, KnowledgeNode, CommitteeRole, CommitteeAssignment, TeacherProfile
} from './domain/types';
import { createEmptyWorkflowState } from './domain/gradingTask';
import { listGradingTasks, saveGradingTask } from './services/gradingTaskApi';
import {
  createRosterClass,
  createRosterCommitteeRole,
  createRosterStudent,
  deleteRosterStudent,
  deleteRosterCommitteeRole,
  getRoster,
  importRosterStudents,
  previewRosterStudentsImport,
  saveClassCommitteeAssignments,
  toggleRosterClassArchive,
  updateRosterClass, updateRosterCommitteeRole,
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
import { getKnowledgeGraph } from './services/resourceApi';
import { getScheduleWorkspace, removeReminder, removeScheduleItem, saveReminder, saveReminderBatch, saveReminderSeries, saveScheduleBatch, saveScheduleItem, saveSchedulePeriods } from './services/scheduleApi';
import TagManagement from './features/tags/TagManagement';
import LessonPlanWorkspace from './features/lesson-plan/LessonPlanWorkspace';
import GradingWorkspace from './features/grading/GradingWorkspace';
import DiagnosisWorkspace, { DiagnosisTab } from './features/diagnosis/DiagnosisWorkspace';
import CareerPlaceholder from './features/career/CareerPlaceholder';

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

const defaultTeacherProfile: TeacherProfile = {
  nickname: '王老师',
  realName: '王明',
  schoolName: '江城实验中学',
  title: '一级教师'
};

const readTeacherProfile = (): TeacherProfile => {
  try {
    const stored = JSON.parse(localStorage.getItem('teacher-profile') ?? '{}') as Partial<TeacherProfile>;
    return { ...defaultTeacherProfile, ...stored };
  } catch {
    return defaultTeacherProfile;
  }
};

const createInitialWorkflowState = (task: WorkbenchTask) => {
  return createEmptyWorkflowState(task);
};

export default function App() {
  // Navigation & View State
  const [activePage, setActivePage] = useState<PageId>('workbench');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentManagementTargetId, setStudentManagementTargetId] = useState<string | null>(null);
  const [diagnosisRequestedTab, setDiagnosisRequestedTab] = useState<DiagnosisTab | null>(null);
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
  const [committeeRoles, setCommitteeRoles] = useState<CommitteeRole[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<WorkbenchTask[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [reminders, setReminders] = useState<TimerReminder[]>([]);
  const [schedulePeriods, setSchedulePeriods] = useState<SchedulePeriod[]>([]);
  const [showWeekends, setShowWeekends] = useState(() => localStorage.getItem('schedule-show-weekends') === 'true');
  const [settingsRequestedSection, setSettingsRequestedSection] = useState<'schedule-periods' | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [workflowStates, setWorkflowStates] = useState<Record<string, WorkflowState>>({});
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>(readTeacherProfile);

  const loadKnowledgeCatalog = useCallback(async () => {
    const graph = await getKnowledgeGraph();
    setKnowledgeNodes(graph.nodes
      .filter(node => node.type === 'knowledge' || node.type === 'ability')
      .map(node => ({
        id: node.id,
        name: node.name,
        type: node.type === 'ability' ? 'capability' : 'knowledge',
        typeName: node.type === 'ability' ? '能力点' : '知识点',
        desc: node.description,
        weight: 3
      })));
  }, []);

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
      setCommitteeRoles(snapshot.committeeRoles);
      const preferredClass = snapshot.classes.find(item => item.status === 'active');
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
    void loadKnowledgeCatalog().catch(() => undefined);
    void listGradingTasks().then(loadedTasks => {
      setTasks(loadedTasks);
      setWorkflowStates(Object.fromEntries(loadedTasks.map(task => [task.id, createInitialWorkflowState(task)])));
    }).catch(() => undefined);
    void getScheduleWorkspace().then(workspace => {
      setSchedule(workspace.schedule);
      setReminders(workspace.reminders);
      setSchedulePeriods(workspace.periods);
    }).catch(() => undefined);
  }, [loadKnowledgeCatalog]);

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
  const handleAddScheduleItem = async (item: ScheduleItem) => {
    const saved = await saveScheduleItem(item);
    setSchedule(current => [...current.filter(existing => existing.id !== saved.id), saved]);
    triggerToast('课表已保存');
  };

  const handleUpdateScheduleItem = async (updated: ScheduleItem) => {
    const saved = await saveScheduleItem(updated);
    setSchedule(current => current.map(item => item.id === saved.id ? saved : item));
    triggerToast('课表已更新');
  };

  const handleDeleteScheduleItem = async (itemId: string) => {
    await removeScheduleItem(itemId);
    setSchedule(current => current.filter(item => item.id !== itemId));
    triggerToast('课程已删除');
  };

  // 3. Reminders list toggles
  const handleAddReminder = async (reminder: TimerReminder, scope: 'single' | 'future' = 'single') => {
    const saved = scope === 'future' ? await saveReminderSeries(reminder) : [await saveReminder(reminder)];
    const workspace = await getScheduleWorkspace();
    setReminders(workspace.reminders);
    triggerToast(scope === 'future' ? `已更新“${reminder.name}”及后续日程` : `日程“${saved[0].name}”已保存`);
  };

  const handleAddReminderBatch = async (items: TimerReminder[]) => {
    const saved = await saveReminderBatch(items);
    setReminders(current => [...current.filter(item => !saved.some(next => next.id === item.id)), ...saved]);
    triggerToast(`已批量新建 ${saved.length} 条日程`);
  };

  const handleUpdateReminderBatch = async (items: TimerReminder[]) => {
    const saved = await saveReminderBatch(items);
    const workspace = await getScheduleWorkspace();
    setReminders(workspace.reminders);
    triggerToast(`已更新 ${saved.length} 条日程`);
  };

  const handleToggleReminderStatus = async (reminderId: string) => {
    const current = reminders.find(item => item.id === reminderId);
    if (!current) return;
    await saveReminder({ ...current, status: current.status === 'completed' ? 'active' : current.status === 'inactive' ? 'active' : 'completed' });
    const workspace = await getScheduleWorkspace();
    setReminders(workspace.reminders);
    triggerToast(current.status === 'active' ? '日程已完成' : '日程已恢复');
  };

  const handleDeleteReminder = async (reminderId: string) => {
    await removeReminder(reminderId);
    setReminders(current => current.filter(item => item.id !== reminderId));
    triggerToast('日程已删除');
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
      if (saved.status === 'archived' && selectedClassId === saved.id) {
        const fallback = classes.find(item => item.id !== saved.id && item.status === 'active');
        setSelectedClassId(fallback?.id ?? '');
      }
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
            studentCount: item.studentCount + 1
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

  const handleBulkImport = async (classId: string, grid: Parameters<typeof importRosterStudents>[1]) => {
    const result = await importRosterStudents(classId, grid);
    const snapshot = await getRoster();
    setClasses(snapshot.classes);
    setStudents(snapshot.students);
    if (snapshot.classes.some(item => item.id === classId && item.status === 'active')) setSelectedClassId(classId);
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
        committeeRoleIds: []
      })));
      const snapshot = await getRoster();
      setClasses(snapshot.classes);
      setStudents(snapshot.students);
      triggerToast(`成功将选中的 ${studentIds.length} 名学生批量调入到 [${targetClass.name}]！`);
    } catch (error) {
      triggerToast(`批量调班失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleSaveCommitteeAssignments = async (classId: string, assignments: Omit<CommitteeAssignment, 'classId'>[]) => {
    const saved = await saveClassCommitteeAssignments(classId, assignments);
    const savedById = new Map(saved.map(item => [item.id, item]));
    setStudents(current => current.map(item => savedById.get(item.id) ?? item));
    triggerToast('班委任职已保存');
  };

  const handleCreateCommitteeRole = async (name: string) => {
    const role = await createRosterCommitteeRole(name);
    setCommitteeRoles(current => [...current, role]);
    triggerToast(`已添加班委职位“${role.name}”`);
  };

  const handleUpdateCommitteeRole = async (roleId: string, name: string) => {
    const role = await updateRosterCommitteeRole(roleId, name);
    setCommitteeRoles(current => current.map(item => item.id === role.id ? role : item));
    triggerToast('班委职位已更新');
  };

  const handleDeleteCommitteeRole = async (roleId: string) => {
    await deleteRosterCommitteeRole(roleId);
    setCommitteeRoles(current => current.filter(item => item.id !== roleId));
    triggerToast('班委职位已删除');
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

  const selectedClass = classes.find(c => c.id === selectedClassId && c.status === 'active')
    ?? classes.find(c => c.status === 'active')
    ?? classes[0];
  const pendingReviewCount = reviewQueue.filter(r => r.status === 'pending').length
    + Object.keys(workflowStates).flatMap(taskId => workflowStates[taskId].questionGradingStates ?? []).flatMap(state => state.calibrationSamples).filter(sample => sample.status !== 'confirmed' && (sample.needsTeacherReview || sample.recognitionConflict || sample.gradingConfidence < lowConfidenceThreshold)).length;
  const activeGradingTaskCount = tasks.filter(task => task.status !== 'completed').length;
  const navGroups = createNavGroups(activeGradingTaskCount);

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
      teacherProfile={teacherProfile}
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
              committeeRoles={committeeRoles}
              selectedClassId={selectedClassId}
              onSelectClass={setSelectedClassId}
              onManageStudent={(studentId) => {
                setSelectedStudentId(studentId);
                setStudentManagementTargetId(studentId);
                setActivePage('student-mgmt');
              }}
              onViewStudentProfile={(studentId) => {
                setSelectedStudentId(studentId);
                setDiagnosisRequestedTab('student');
                setActivePage('diagnosis-workspace');
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
              onUpdateStudent={handleUpdateStudent}
            />
          )}

          {activePage === 'class-mgmt' && (
            <ClassManagement
              classes={classes}
              students={students}
              committeeRoles={committeeRoles}
              onAddClass={handleAddClass}
              onUpdateClass={handleUpdateClass}
              onArchiveClass={handleArchiveClass}
              onSaveCommitteeAssignments={handleSaveCommitteeAssignments}
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
              committeeRoles={committeeRoles}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onBulkImport={handleBulkImport}
              onPreviewBulkImport={previewRosterStudentsImport}
              onBulkMoveClass={handleBulkMoveClass}
              onBulkAddTags={handleBulkAddTags}
              targetStudentId={studentManagementTargetId}
              onTargetStudentHandled={() => setStudentManagementTargetId(null)}
            />
          )}

          {activePage === 'schedule' && (
            <ScheduleReminder
              schedule={schedule}
              reminders={reminders}
              classes={classes}
              selectedClassId={selectedClassId}
              onSelectClass={setSelectedClassId}
              periods={schedulePeriods}
              showWeekends={showWeekends}
              onOpenPeriodSettings={() => {
                setSettingsRequestedSection('schedule-periods');
                setActivePage('settings');
              }}
              onAddScheduleItem={handleAddScheduleItem}
              onUpdateScheduleItem={handleUpdateScheduleItem}
              onDeleteScheduleItem={handleDeleteScheduleItem}
              onImportSchedule={async items => {
                const saved = await saveScheduleBatch(items);
                setSchedule(current => [...current.filter(item => !saved.some(next => next.id === item.id)), ...saved]);
                triggerToast(`已导入 ${saved.length} 项课程`);
              }}
              onAddReminder={handleAddReminder}
              onAddReminderBatch={handleAddReminderBatch}
              onUpdateReminderBatch={handleUpdateReminderBatch}
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
              knowledgeNodes={knowledgeNodes}
              reviewQueue={reviewQueue}
              lowConfidenceThreshold={lowConfidenceThreshold}
              ocrHumanReviewThreshold={ocrHumanReviewThreshold}
              ocrAutoPassThreshold={ocrAutoPassThreshold}
              onCreateTask={(task) => {
                setTasks(current => [task, ...current]);
                setWorkflowStates(current => ({ ...current, [task.id]: createEmptyWorkflowState(task) }));
                void saveGradingTask(task).catch(() => triggerToast('任务保存失败，请稍后重试'));
                triggerToast('批改任务已创建，可进入作业工作流继续配置');
              }}
              onEnterWorkflow={(task) => {
                setSelectedClassId(task.classId);
              }}
              onSelectTask={(task) => {
                setSelectedClassId(task.classId);
              }}
              onUpdateTask={async (updatedTask) => {
                const saved = await saveGradingTask(updatedTask);
                setTasks(current => current.map(task => task.id === saved.id ? saved : task));
              }}
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
              committeeRoles={committeeRoles}
              selectedClassId={selectedClassId}
              selectedStudentId={selectedStudentId}
              onSelectClass={setSelectedClassId}
              onSelectStudent={setSelectedStudentId}
              onEditStudent={(studentId) => {
                setSelectedStudentId(studentId);
                setStudentManagementTargetId(studentId);
                setActivePage('student-mgmt');
                triggerToast('已打开该学生档案');
              }}
              onAddObservation={handleAddObservation}
              onUpdateStudent={handleUpdateStudent}
              onNavigate={handleNavigate}
              onShowToast={triggerToast}
              requestedTab={diagnosisRequestedTab}
              onRequestedTabHandled={() => setDiagnosisRequestedTab(null)}
            />
          )}

          {(activePage === 'knowledge-graph' || activePage === 'library-editor') && (
            <KnowledgeLibrary
              mode={activePage === 'library-editor' ? 'editor' : libraryMode}
              onSwitchMode={(mode) => {
                setLibraryMode(mode);
                setActivePage(mode === 'graph' ? 'knowledge-graph' : 'library-editor');
              }}
              onKnowledgeChanged={loadKnowledgeCatalog}
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
              showWeekends={showWeekends}
              onShowWeekendsChange={value => {
                setShowWeekends(value);
                localStorage.setItem('schedule-show-weekends', String(value));
              }}
              schedulePeriods={schedulePeriods}
              schedule={schedule}
              onSaveSchedulePeriods={async periods => {
                const saved = await saveSchedulePeriods(periods);
                setSchedulePeriods(saved);
              }}
              requestedSection={settingsRequestedSection}
              onRequestedSectionHandled={() => setSettingsRequestedSection(null)}
              classes={classes}
              committeeRoles={committeeRoles}
              selectedClassId={selectedClassId}
              onSelectClass={setSelectedClassId}
              onShowToast={triggerToast}
              onCreateCommitteeRole={handleCreateCommitteeRole}
              onUpdateCommitteeRole={handleUpdateCommitteeRole}
              onDeleteCommitteeRole={handleDeleteCommitteeRole}
              teacherProfile={teacherProfile}
              onSaveTeacherProfile={profile => {
                setTeacherProfile(profile);
                localStorage.setItem('teacher-profile', JSON.stringify(profile));
              }}
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

