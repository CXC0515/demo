/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  User, Award, AlertCircle, TrendingUp, Tag, ShieldAlert, 
  MessageSquare, Bell, ArrowRight, BookOpen, GraduationCap 
} from 'lucide-react';
import { Student, SchoolClass } from '../../domain/types';

interface VirtualClassroomProps {
  students: Student[];
  classes: SchoolClass[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onNavigate: (pageId: string, subPageId?: string) => void;
  onViewStudentProfile: (studentId: string) => void;
  onAddObservation: (studentId: string, text: string) => void;
  onSetStudentReminder: (studentId: string, reminderName: string) => void;
}

export default function VirtualClassroom({
  students,
  classes,
  selectedClassId,
  onSelectClass,
  onNavigate,
  onViewStudentProfile,
  onAddObservation,
  onSetStudentReminder
}: VirtualClassroomProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [obsText, setObsText] = useState('');
  const [remText, setRemText] = useState('');
  const [showObsInput, setShowObsInput] = useState(false);
  const [showRemInput, setShowRemInput] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Filter students by selected class
  const classStudents = students.filter(s => s.classId === selectedClassId);
  const activeClass = classes.find(c => c.id === selectedClassId) || classes[0];

  // Map students into a 6x7 grid (42 seats)
  // To make it look super neat, we map our real mock students to specific desks, and auto-generate the rest.
  const gridRows = 6;
  const gridCols = 7;
  const desks: (Student | { id: string; name: string; isPlaceholder: boolean; status: 'good' })[] = [];

  // Generate placeholder students for remaining seats
  const realStudentsMap = new Map(classStudents.map(s => [parseInt(s.studentNo.slice(-2)) || 1, s]));

  let placeholderIndex = 1;
  for (let seatNum = 1; seatNum <= gridRows * gridCols; seatNum++) {
    const studentAtSeat = realStudentsMap.get(seatNum);
    if (studentAtSeat) {
      desks.push(studentAtSeat);
    } else {
      desks.push({
        id: `placeholder-${seatNum}`,
        name: `同学${seatNum}`,
        isPlaceholder: true,
        status: 'good'
      });
    }
  }

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'outstanding': return 'bg-blue-500 text-blue-500 shadow-blue-500/35';
      case 'good': return 'bg-emerald-500 text-emerald-500 shadow-emerald-500/35';
      case 'warning': return 'bg-amber-500 text-amber-500 shadow-amber-500/35';
      case 'risk': return 'bg-red-500 text-red-500 shadow-red-500/35';
      default: return 'bg-slate-300 text-slate-300 shadow-slate-300/35';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'outstanding': return '表现突出';
      case 'good': return '状态良好';
      case 'warning': return '需要关注';
      case 'risk': return '近期风险';
      default: return '正常';
    }
  };

  const handleAddObservationSubmit = () => {
    if (!obsText.trim() || !selectedStudentId) return;
    onAddObservation(selectedStudentId, obsText);
    setObsText('');
    setShowObsInput(false);
  };

  const handleAddReminderSubmit = () => {
    if (!remText.trim() || !selectedStudentId) return;
    onSetStudentReminder(selectedStudentId, remText);
    setRemText('');
    setShowRemInput(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-fade-in" id="classroom-page">
      
      {/* Left: Interactive Classroom Grid */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        
        {/* Classroom Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 glass-panel rounded-2xl p-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              班级可视化：{activeClass.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              点击课桌即可查看对应学生近期听写、作业、课堂观察以及多维度家校学情。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-3 py-1.5 text-xs rounded-xl font-bold transition-all ${editMode ? 'bg-emerald-700 text-white' : 'bg-white/80 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-700'}`}
            >
              {editMode ? '完成编辑' : '编辑座位'}
            </button>
            <span className="text-xs text-slate-400">切换班级:</span>
            <select
              id="cr-class-select"
              value={selectedClassId}
              onChange={(e) => {
                onSelectClass(e.target.value);
                setSelectedStudentId(null);
              }}
              className="px-3 py-1.5 bg-white/80 dark:bg-zinc-800 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {classes.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3D-feeling Classroom Stage */}
        <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative min-h-[560px] bg-gradient-to-b from-slate-100/50 to-slate-200/20 dark:from-zinc-900/40 dark:to-zinc-900/20">
          
          {/* Back wall: far end of classroom */}
          <div className="w-full flex flex-col items-center justify-center space-y-1 border-b border-slate-200/60 dark:border-zinc-800 pb-3 mb-4">
            <div className="w-72 py-1.5 bg-slate-200/70 dark:bg-zinc-800/70 text-slate-500 rounded-lg shadow-inner text-center text-xs tracking-widest font-mono">
              教室后排
            </div>
          </div>

          {/* Student Desk Area */}
          <div className="classroom-grid flex-1 flex flex-col justify-center">
            <div className="classroom-desk-area grid grid-cols-7 gap-x-4 gap-y-6 max-w-4xl mx-auto w-full px-2">
              {desks.map((desk, idx) => {
                const isReal = !('isPlaceholder' in desk);
                const isSelected = selectedStudentId === desk.id;
                
                return (
                  <div
                    key={desk.id}
                    id={`student-desk-${desk.id}`}
                    onClick={() => {
                      if (isReal) {
                        setSelectedStudentId(desk.id);
                      }
                    }}
                    className={`student-desk p-2.5 rounded-xl border flex flex-col items-center justify-between text-center cursor-pointer transition-all relative ${
                      isReal 
                        ? isSelected
                          ? 'bg-emerald-600/10 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                          : 'bg-white dark:bg-zinc-800/80 hover:bg-slate-50 border-slate-200 dark:border-zinc-700'
                        : 'bg-slate-50/50 dark:bg-zinc-800/20 border-slate-100 dark:border-zinc-900 opacity-30 cursor-not-allowed pointer-events-none'
                    }`}
                  >
                    {/* Status Indicator Dot at corner */}
                    {isReal && (
                      <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full shadow-sm ${getStatusColor(desk.status)}`}></span>
                    )}

                    {/* Small visual Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 text-xs font-semibold ${
                      isReal 
                        ? isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-slate-300'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'
                    }`}>
                      {isReal ? (
                        desk.isRepresentative ? (
                          <Award className="w-4 h-4 text-amber-500" />
                        ) : (
                          desk.name[0]
                        )
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <span className={`text-[11px] font-medium truncate max-w-full ${
                      isReal 
                        ? isSelected 
                          ? 'text-emerald-700 dark:text-emerald-400 font-bold' 
                          : 'text-slate-700 dark:text-slate-300' 
                        : 'text-slate-400'
                    }`}>
                      {desk.name}
                    </span>

                    {/* Simple compact duty tag */}
                    {isReal && desk.isRepresentative && (
                      <span className="text-[8px] scale-90 px-1 py-0.2 bg-amber-100 text-amber-800 rounded mt-0.5 whitespace-nowrap">
                        课代表
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blackboard and podium at bottom: teacher viewpoint origin */}
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="w-[420px] max-w-full py-2 bg-slate-800 dark:bg-zinc-900 text-slate-100 rounded-2xl shadow-inner text-center text-xs tracking-[0.25em] font-mono">
              黑板 · 统编版七下语文
            </div>
            <div className="w-80 h-14 rounded-t-[28px] bg-gradient-to-b from-amber-100 to-amber-200 dark:from-zinc-800 dark:to-zinc-900 border border-amber-200/80 dark:border-zinc-700 shadow-inner flex items-center justify-center">
              <span className="text-xs font-black text-amber-900 dark:text-zinc-200 tracking-[0.35em]">讲台</span>
            </div>
          </div>

          {editMode && (
            <div className="mt-4 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-black text-emerald-800 dark:text-emerald-300">座位编辑模式</span>
                <p className="text-slate-500 mt-1">可切换“排课桌 / 排座位”。当前为原型模式：点击学生卡片查看，后续接入拖拽换座。</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold">排课桌</button>
                <button className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white font-bold">排座位</button>
              </div>
            </div>
          )}

          {/* Status Legends at bottom */}
          <div className="mt-6 pt-4 border-t border-slate-200/40 dark:border-zinc-800/40 flex flex-wrap justify-center gap-6 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>状态良好 ({classStudents.filter(s => s.status === 'good').length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>表现突出 ({classStudents.filter(s => s.status === 'outstanding').length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>需要关注 ({classStudents.filter(s => s.status === 'warning').length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>近期风险 ({classStudents.filter(s => s.status === 'risk').length})</span>
            </div>
          </div>

        </div>
      </div>

      {/* Right: Selected Student Details Draw/Panel */}
      <div className={`w-full lg:w-[380px] flex-shrink-0 flex flex-col ${selectedStudent ? '' : 'hidden lg:flex'}`}>
        <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col justify-between overflow-y-auto space-y-6 min-h-[500px]">
          {selectedStudent ? (
            <div className="space-y-6 animate-fade-in" id="student-detail-panel">
              
              {/* Profile Card Header */}
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="w-12 h-12 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center justify-center font-bold text-lg">
                    {selectedStudent.name[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      {selectedStudent.name}
                      {selectedStudent.isRepresentative && (
                        <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-800 rounded font-semibold flex items-center gap-0.5">
                          <Award className="w-2.5 h-2.5 text-amber-600" />
                          语文课代表
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">学号：{selectedStudent.studentNo} · {selectedStudent.className}</p>
                  </div>
                </div>

                {/* Status indicator pill */}
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full ${
                    selectedStudent.status === 'good' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                    selectedStudent.status === 'outstanding' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                    selectedStudent.status === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                    'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedStudent.status === 'good' ? 'bg-emerald-500' :
                      selectedStudent.status === 'outstanding' ? 'bg-blue-500' :
                      selectedStudent.status === 'warning' ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}></span>
                    {getStatusLabel(selectedStudent.status)}
                  </span>
                </div>
              </div>

              {/* Behavior & Home-School Link Tags */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  日常表现标签
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStudent.behaviorTags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 font-medium">
                      {tag}
                    </span>
                  ))}
                  {selectedStudent.familyStatusTag && (
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-rose-500/10 text-rose-800 dark:text-rose-400 font-semibold border border-rose-500/20">
                      家校：{selectedStudent.familyStatusTag}
                    </span>
                  )}
                </div>
              </div>

              {/* Strengths & Weaknesses Knowledge Points */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-150 dark:border-zinc-800">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">优势知识点</span>
                  <div className="space-y-1">
                    {selectedStudent.strongKnowledge.map((k, idx) => (
                      <span key={idx} className="block text-xs text-emerald-700 dark:text-emerald-400 font-medium truncate">
                        ✓ {k}
                      </span>
                    ))}
                    {selectedStudent.strongKnowledge.length === 0 && <span className="text-xs text-slate-400">暂无评估</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">薄弱知识点</span>
                  <div className="space-y-1">
                    {selectedStudent.weakKnowledge.map((k, idx) => (
                      <span key={idx} className="block text-xs text-red-700 dark:text-red-400 font-medium truncate">
                        ✗ {k}
                      </span>
                    ))}
                    {selectedStudent.weakKnowledge.length === 0 && <span className="text-xs text-slate-400">暂无评估</span>}
                  </div>
                </div>
              </div>

              {/* Parent communication summary */}
              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  家校关注：{selectedStudent.parent.relation} ({selectedStudent.parent.name})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  “{selectedStudent.parent.remark}”
                </p>
              </div>

              {/* Recent Homework Trend (visual mock with tiny blocks) */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  近期作业质量趋势 (最后 5 次)
                </h4>
                <div className="flex items-end gap-2 h-14 pt-2">
                  {selectedStudent.recentHomeworkTrend.map((score, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-slate-400 font-mono">{score}</span>
                      <div 
                        className={`w-full rounded-t-sm transition-all duration-300 ${
                          score >= 90 ? 'bg-emerald-500/80 dark:bg-emerald-500/60' :
                          score >= 80 ? 'bg-blue-500/80' :
                          score >= 70 ? 'bg-amber-500/80' : 'bg-red-500/80'
                        }`}
                        style={{ height: `${(score / 100) * 40}px` }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Add Observation Input */}
              <div className="space-y-2 pt-2 border-t border-slate-150 dark:border-zinc-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400">课堂随手记</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setShowObsInput(!showObsInput); setShowRemInput(false); }}
                      className="text-xs text-emerald-700 hover:underline cursor-pointer"
                    >
                      {showObsInput ? '取消' : '添加记录'}
                    </button>
                    <button 
                      onClick={() => { setShowRemInput(!showRemInput); setShowObsInput(false); }}
                      className="text-xs text-indigo-700 hover:underline cursor-pointer"
                    >
                      {showRemInput ? '取消' : '设提醒'}
                    </button>
                  </div>
                </div>

                {showObsInput && (
                  <div className="space-y-2 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                    <textarea
                      value={obsText}
                      onChange={(e) => setObsText(e.target.value)}
                      placeholder="记录该学生今日表现，如课堂提问、背诵情况等..."
                      className="w-full h-16 text-xs p-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none"
                    />
                    <button
                      onClick={handleAddObservationSubmit}
                      className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                    >
                      保存观察日志
                    </button>
                  </div>
                )}

                {showRemInput && (
                  <div className="space-y-2 bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                    <input
                      type="text"
                      value={remText}
                      onChange={(e) => setRemText(e.target.value)}
                      placeholder="例如：周五放学后抽查该生《陋室铭》背诵"
                      className="w-full text-xs p-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none"
                    />
                    <button
                      onClick={handleAddReminderSubmit}
                      className="w-full py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                    >
                      创建定时提醒
                    </button>
                  </div>
                )}

                {/* Show last observation log if any */}
                {selectedStudent.observationHistory.length > 0 && !showObsInput && (
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/20 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <span className="font-semibold block text-slate-600 dark:text-slate-300">
                      最新观察 ({selectedStudent.observationHistory[selectedStudent.observationHistory.length - 1].date}):
                    </span>
                    <p>“{selectedStudent.observationHistory[selectedStudent.observationHistory.length - 1].content}”</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onViewStudentProfile(selectedStudent.id)}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-all active:scale-98 cursor-pointer"
                >
                  学生画像
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onNavigate('student-mgmt')}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-all active:scale-98 cursor-pointer"
                >
                  编辑档案
                </button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-2 h-full">
              <User className="w-12 h-12 stroke-1 text-slate-300" />
              <p className="text-sm">未选择学生</p>
              <p className="text-xs max-w-[200px]">点击左侧座位的任意学生课桌，在此处显示该学生深度多维度学情分析。</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

