/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BarChart3, UserSquare2 } from 'lucide-react';
import { CommitteeRole, SchoolClass, Student, TeacherObservation } from '../../domain/types';
import ClassDiagnosis from './ClassDiagnosis';
import StudentProfile from '../students/StudentProfileV2';

interface DiagnosisWorkspaceProps {
  students: Student[];
  classes: SchoolClass[];
  committeeRoles: CommitteeRole[];
  selectedClassId: string;
  selectedStudentId: string;
  onSelectClass: (classId: string) => void;
  onSelectStudent: (studentId: string) => void;
  onEditStudent: (studentId: string) => void;
  onAddObservation: (studentId: string, note: TeacherObservation) => void;
  onUpdateStudent: (student: Student) => Promise<boolean>;
  onNavigate: (pageId: string, subPageId?: string) => void;
  onShowToast: (message: string) => void;
  requestedTab?: DiagnosisTab | null;
  onRequestedTabHandled?: () => void;
}

export type DiagnosisTab = 'class' | 'student';

const tabs: { id: DiagnosisTab; label: string; icon: React.ElementType }[] = [
  { id: 'class', label: '班级诊断', icon: BarChart3 },
  { id: 'student', label: '学生画像', icon: UserSquare2 }
];

export default function DiagnosisWorkspace({
  students,
  classes,
  committeeRoles,
  selectedClassId,
  selectedStudentId,
  onSelectClass,
  onSelectStudent,
  onEditStudent,
  onAddObservation,
  onUpdateStudent,
  onNavigate,
  onShowToast,
  requestedTab,
  onRequestedTabHandled
}: DiagnosisWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<DiagnosisTab>('class');
  const [studentDetailTargetId, setStudentDetailTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!requestedTab) return;
    setActiveTab(requestedTab);
    if (requestedTab === 'student' && selectedStudentId) {
      setStudentDetailTargetId(selectedStudentId);
    }
    onRequestedTabHandled?.();
  }, [onRequestedTabHandled, requestedTab, selectedStudentId]);

  return (
    <div className="space-y-5 animate-fade-in" id="diagnosis-workspace-page">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-100/60 p-2 dark:bg-zinc-900/60">
        <div className="flex flex-wrap gap-1.5">{tabs.map(tab => {
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
            </button>
          );
        })}</div>
        <label className="flex items-center gap-2 px-2 text-xs font-bold text-slate-400">
          <span className="hidden sm:inline">当前班级</span>
          <select value={selectedClassId} onChange={event => onSelectClass(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-100">
            {classes.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>

      {activeTab === 'class' && (
        <ClassDiagnosis
          students={students}
          classes={classes}
          selectedClassId={selectedClassId}
          onNavigate={(pageId, subPageId) => {
            if (pageId === 'diagnosis' && subPageId === 'profile') {
              setActiveTab('student');
              return;
            }
            onNavigate(pageId, subPageId);
          }}
          onShowToast={onShowToast}
        />
      )}

      {activeTab === 'student' && (
        <StudentProfile
          students={students}
          committeeRoles={committeeRoles}
          selectedClassId={selectedClassId}
          selectedStudentId={selectedStudentId}
          onSelectStudent={onSelectStudent}
          onEditStudent={onEditStudent}
          onAddObservation={onAddObservation}
          onUpdateStudent={onUpdateStudent}
          onShowToast={onShowToast}
          targetStudentId={studentDetailTargetId}
          onTargetStudentHandled={() => setStudentDetailTargetId(null)}
        />
      )}
    </div>
  );
}

