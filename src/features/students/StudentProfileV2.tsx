/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Eye, MessageSquare, Search, TrendingUp } from 'lucide-react';
import { SchoolClass, Student, TeacherObservation } from '../../domain/types';

interface StudentProfileV2Props {
  students: Student[];
  classes: SchoolClass[];
  selectedClassId: string;
  selectedStudentId: string;
  onSelectClass: (classId: string) => void;
  onSelectStudent: (studentId: string) => void;
  onEditStudent: (studentId: string) => void;
  onAddObservation: (studentId: string, note: TeacherObservation) => void;
  onShowToast: (message: string) => void;
}

const statusLabel = {
  good: '状态良好',
  warning: '需要关注',
  risk: '近期风险',
  outstanding: '表现突出'
};

const statusStyle = {
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  risk: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
  outstanding: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
};

export default function StudentProfileV2({
  students,
  classes,
  selectedClassId,
  selectedStudentId,
  onSelectClass,
  onSelectStudent,
  onEditStudent,
  onAddObservation,
  onShowToast
}: StudentProfileV2Props) {
  const [query, setQuery] = useState('');
  const [detailMode, setDetailMode] = useState(false);
  const [note, setNote] = useState('');

  const classStudents = useMemo(() => {
    return students
      .filter(s => s.classId === selectedClassId)
      .filter(s => !query || `${s.name}${s.studentNo}`.includes(query))
      .sort((a, b) => a.studentNo.localeCompare(b.studentNo));
  }, [query, selectedClassId, students]);

  const selectedStudent = students.find(s => s.id === selectedStudentId) ?? classStudents[0] ?? students[0];

  const openDetail = (studentId: string) => {
    onSelectStudent(studentId);
    setDetailMode(true);
  };

  const addNote = () => {
    if (!note.trim()) return;
    onAddObservation(selectedStudent.id, {
      date: '2026-07-03',
      type: 'neutral',
      category: 'study',
      content: note.trim(),
      author: '王老师'
    });
    setNote('');
    onShowToast('教师观察已写入学生画像');
  };

  if (detailMode) {
    const errors = selectedStudent.homeworkHistory.flatMap(hw => hw.knowledgeErrors.map(err => ({ hw, err })));

    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <button onClick={() => setDetailMode(false)} className="text-xs font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" />
              返回学生列表
            </button>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50">{selectedStudent.name} 的学生画像</h2>
            <p className="text-sm text-slate-500 mt-1">{selectedStudent.className} · 学号 {selectedStudent.studentNo}</p>
          </div>
          <button onClick={() => onEditStudent(selectedStudent.id)} className="px-4 py-2 rounded-2xl bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-all">
            <Edit3 className="w-4 h-4" />
            编辑学生档案
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <section className="space-y-5">
            <div className="glass-panel rounded-[24px] p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center text-3xl font-black shadow-xl">
                {selectedStudent.name[0]}
              </div>
              <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="rounded-2xl bg-slate-50/80 dark:bg-zinc-900/50 p-3">
                  <p className="text-slate-400">状态</p>
                  <p className="font-black mt-1">{statusLabel[selectedStudent.status]}</p>
                </div>
                <div className="rounded-2xl bg-slate-50/80 dark:bg-zinc-900/50 p-3">
                  <p className="text-slate-400">课代表</p>
                  <p className="font-black mt-1">{selectedStudent.isRepresentative ? '是' : '否'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50/80 dark:bg-zinc-900/50 p-3">
                  <p className="text-slate-400">家长联系人</p>
                  <p className="font-black mt-1">{selectedStudent.parent.name}</p>
                </div>
                <div className="rounded-2xl bg-slate-50/80 dark:bg-zinc-900/50 p-3">
                  <p className="text-slate-400">家庭关注</p>
                  <p className="font-black mt-1">{selectedStudent.familyStatusTag || '普通'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="glass-panel rounded-[24px] p-5">
                <h3 className="text-sm font-black mb-3">学得好的知识点 / 题型</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedStudent.strongKnowledge.map(item => (
                    <span key={item} className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 text-xs font-bold">{item}</span>
                  ))}
                </div>
              </div>
              <div className="glass-panel rounded-[24px] p-5">
                <h3 className="text-sm font-black mb-3">学得不好的知识点 / 题型</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedStudent.weakKnowledge.map(item => (
                    <span key={item} className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs font-bold">{item}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[24px] p-5">
              <h3 className="text-sm font-black mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-700" />最近作业趋势</h3>
              <div className="h-32 flex items-end gap-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/50 p-4">
                {selectedStudent.recentHomeworkTrend.map((score, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs font-mono font-black text-emerald-800 dark:text-emerald-300">{score}</span>
                    <div className="w-full max-w-10 rounded-t-xl bg-emerald-600" style={{ height: `${Math.max(score * 0.75, 12)}px` }}></div>
                    <span className="text-[10px] text-slate-400">第{index + 1}次</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-[24px] overflow-hidden">
              <div className="p-5 border-b border-slate-200/70 dark:border-zinc-800/80">
                <h3 className="text-sm font-black">知识点错误记录</h3>
              </div>
              {errors.length ? errors.map(({ hw, err }) => (
                <div key={`${hw.id}-${err.questionId}`} className="p-4 grid grid-cols-1 md:grid-cols-[120px_1fr_120px] gap-3 text-sm border-b border-slate-200/60 dark:border-zinc-800/70 last:border-b-0">
                  <span className="text-xs text-slate-400">{hw.date}</span>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{hw.title} · {err.questionTitle}</p>
                    <p className="text-xs text-slate-500 mt-1">{err.points.join('、')} · {err.errorType}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-700">待巩固</span>
                </div>
              )) : (
                <div className="p-6 text-center text-sm text-slate-400">暂无知识点错误记录</div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="glass-panel rounded-[24px] p-5 space-y-3">
              <h3 className="text-sm font-black flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-700" />教师观察</h3>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} placeholder="记录课堂表现、作业习惯或家校沟通要点..." className="w-full p-3 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 text-sm resize-none focus:outline-none" />
              <button onClick={addNote} className="w-full py-2.5 rounded-2xl bg-emerald-700 text-white text-xs font-bold active:scale-95 transition-all">保存观察</button>
            </div>
            <div className="glass-panel rounded-[24px] p-5">
              <h3 className="text-sm font-black mb-3">历史观察</h3>
              <div className="space-y-2">
                {selectedStudent.observationHistory.map((item, index) => (
                  <div key={index} className="p-3 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/50 text-xs">
                    <p className="text-slate-400">{item.date}</p>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">{item.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">学情诊断 / 学生画像</p>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">学生画像</h2>
          <p className="text-sm text-slate-500 mt-1">先选择班级，再按学号查看学生画像。此处只查看，不编辑档案。</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedClassId} onChange={(e) => onSelectClass(e.target.value)} className="px-3 py-2 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 text-sm font-bold focus:outline-none">
            {classes.filter(c => c.status === 'active').map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名/学号" className="pl-9 pr-3 py-2 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 text-sm focus:outline-none" />
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-[24px] overflow-hidden">
        <div className="grid grid-cols-[90px_1fr_130px_160px_180px_120px] px-5 py-3 text-[11px] font-black text-slate-400 uppercase border-b border-slate-200/70 dark:border-zinc-800/80">
          <span>学号</span>
          <span>姓名</span>
          <span>学习状态</span>
          <span>家庭关注</span>
          <span>最近趋势</span>
          <span>操作</span>
        </div>
        {classStudents.map(student => (
          <div key={student.id} className="grid grid-cols-[90px_1fr_130px_160px_180px_120px] px-5 py-4 items-center border-b border-slate-200/60 dark:border-zinc-800/70 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-all text-sm">
            <span className="font-mono text-xs text-slate-500">{student.studentNo}</span>
            <span>
              <span className="font-black text-slate-800 dark:text-slate-100">{student.name}</span>
              {student.isRepresentative && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">课代表</span>}
            </span>
            <span className={`w-fit px-2 py-1 rounded-full text-xs font-bold ${statusStyle[student.status]}`}>{statusLabel[student.status]}</span>
            <span className="text-xs text-slate-500">{student.familyStatusTag || '普通'}</span>
            <span className="flex items-end gap-1 h-8">
              {student.recentHomeworkTrend.slice(-5).map((score, index) => (
                <i key={index} className="w-3 rounded-t bg-emerald-500/80" style={{ height: `${Math.max(score / 3, 8)}px` }} />
              ))}
            </span>
            <button onClick={() => openDetail(student.id)} className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              <Eye className="w-3.5 h-3.5" />
              查看画像
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

