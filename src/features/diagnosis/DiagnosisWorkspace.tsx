/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BarChart3, UserSquare2 } from 'lucide-react';
import { SchoolClass, Student, TeacherObservation } from '../../domain/types';
import ClassDiagnosis from './ClassDiagnosis';
import StudentProfile from '../students/StudentProfileV2';

interface DiagnosisWorkspaceProps {
  students: Student[];
  classes: SchoolClass[];
  selectedClassId: string;
  selectedStudentId: string;
  onSelectClass: (classId: string) => void;
  onSelectStudent: (studentId: string) => void;
  onEditStudent: (studentId: string) => void;
  onAddObservation: (studentId: string, note: TeacherObservation) => void;
  onNavigate: (pageId: string, subPageId?: string) => void;
  onShowToast: (message: string) => void;
}

type DiagnosisTab = 'class' | 'student';

const tabs: { id: DiagnosisTab; label: string; icon: React.ElementType }[] = [
  { id: 'class', label: '班级诊断', icon: BarChart3 },
  { id: 'student', label: '学生画像', icon: UserSquare2 }
];

export default function DiagnosisWorkspace({
  students,
  classes,
  selectedClassId,
  selectedStudentId,
  onSelectClass,
  onSelectStudent,
  onEditStudent,
  onAddObservation,
  onNavigate,
  onShowToast
}: DiagnosisWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<DiagnosisTab>('class');

  return (
    <div className="space-y-5 animate-fade-in" id="diagnosis-workspace-page">
      <div className="glass-panel rounded-2xl p-2 flex flex-wrap gap-1.5 bg-slate-100/60 dark:bg-zinc-900/60">
        {tabs.map(tab => {
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
        })}
      </div>

      {activeTab === 'class' && (
        <ClassDiagnosis
          students={students}
          classes={classes}
          selectedClassId={selectedClassId}
          onSelectClass={onSelectClass}
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
          classes={classes}
          selectedClassId={selectedClassId}
          selectedStudentId={selectedStudentId}
          onSelectClass={onSelectClass}
          onSelectStudent={onSelectStudent}
          onEditStudent={onEditStudent}
          onAddObservation={onAddObservation}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}

