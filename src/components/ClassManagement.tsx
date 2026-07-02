/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, Plus, Edit, Trash2, Archive, CheckCircle, Clock, 
  UserCheck, Shield, BookOpen, X, ArrowRight, Search
} from 'lucide-react';
import { SchoolClass, Student } from '../types';

interface ClassManagementProps {
  classes: SchoolClass[];
  students: Student[];
  onAddClass: (newClass: SchoolClass) => void;
  onUpdateClass: (updatedClass: SchoolClass) => void;
  onArchiveClass: (classId: string) => void;
  onEnterClassroom: (classId: string) => void;
}

export default function ClassManagement({
  classes,
  students,
  onAddClass,
  onUpdateClass,
  onArchiveClass,
  onEnterClassroom
}: ClassManagementProps) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRepPicker, setShowRepPicker] = useState(false);
  const [repSearch, setRepSearch] = useState('');

  // Form states
  const [formData, setFormData] = useState<Partial<SchoolClass>>({
    name: '',
    grade: '七年级',
    term: '2026 春季学期',
    headTeacher: '',
    chineseTeacher: '王老师',
    textbookVersion: '统编版七年级下册',
    studentCount: 40,
    representatives: [],
    defaultSubmitTime: '08:00',
    status: 'active'
  });

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStudents = selectedClass ? students.filter(s => s.classId === selectedClass.id) : [];

  const handleOpenAddModal = () => {
    setFormData({
      id: 'c' + (classes.length + 1),
      name: '',
      grade: '七年级',
      term: '2026 春季学期',
      headTeacher: '',
      chineseTeacher: '王老师',
      textbookVersion: '统编版七年级下册',
      studentCount: 40,
      representatives: [],
      defaultSubmitTime: '08:00',
      status: 'active'
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (c: SchoolClass) => {
    setFormData({ ...c });
    setShowEditModal(true);
  };

  const handleSaveAdd = () => {
    if (!formData.name || !formData.headTeacher) {
      alert('请填写班级名称与班主任姓名。');
      return;
    }
    onAddClass(formData as SchoolClass);
    setShowAddModal(false);
  };

  const handleSaveEdit = () => {
    if (!formData.name || !formData.headTeacher) {
      alert('请填写班级名称与班主任姓名。');
      return;
    }
    onUpdateClass(formData as SchoolClass);
    setShowEditModal(false);
  };

  const toggleRepresentative = (studentId: string) => {
    const currentReps = formData.representatives || [];
    let updated: string[];
    if (currentReps.includes(studentId)) {
      updated = currentReps.filter(id => id !== studentId);
    } else {
      updated = [...currentReps, studentId];
    }
    setFormData({ ...formData, representatives: updated });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-fade-in" id="class-mgmt-page">
      
      {/* Main Table */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        <div className="flex items-center justify-between glass-panel rounded-2xl p-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              班级管理控制台
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              设置学校语文授课班级，指定课代表和收作业规则。
            </p>
          </div>
          <button
            id="add-class-btn"
            onClick={handleOpenAddModal}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            新建班级
          </button>
        </div>

        {/* Table container */}
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4">班级名称</th>
                  <th className="px-6 py-4">学期</th>
                  <th className="px-6 py-4">年级</th>
                  <th className="px-6 py-4">班主任</th>
                  <th className="px-6 py-4">课代表</th>
                  <th className="px-6 py-4">收作业规则</th>
                  <th className="px-6 py-4 text-right">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/40">
                {classes.map(c => {
                  const isSelected = selectedClassId === c.id;
                  const repsNames = students
                    .filter(s => c.representatives.includes(s.id))
                    .map(s => s.name)
                    .join('、');

                  return (
                    <tr 
                      key={c.id}
                      onClick={() => setSelectedClassId(c.id)}
                      className={`hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-all cursor-pointer ${
                        isSelected ? 'bg-emerald-600/5 dark:bg-emerald-500/5' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">
                        {c.name}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">{c.term}</td>
                      <td className="px-6 py-4 text-xs">{c.grade}</td>
                      <td className="px-6 py-4 text-xs">{c.headTeacher}</td>
                      <td className="px-6 py-4 text-xs">
                        {repsNames ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                            <UserCheck className="w-3.5 h-3.5" />
                            {repsNames}
                          </span>
                        ) : (
                          <span className="text-slate-400">未设置</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        每日 {c.defaultSubmitTime} 前
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                          c.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                            : 'bg-slate-100 text-slate-400 dark:bg-zinc-800/60'
                        }`}>
                          {c.status === 'active' ? '授课中' : '已归档'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Details Drawer */}
      <div className={`w-full lg:w-[340px] flex-shrink-0 flex flex-col ${selectedClass ? '' : 'hidden lg:flex'}`}>
        <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col justify-between space-y-6 min-h-[460px]">
          {selectedClass ? (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {selectedClass.name}
                  </h3>
                  <p className="text-xs text-slate-400">{selectedClass.term}</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                  selectedClass.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                }`}>
                  {selectedClass.status === 'active' ? '授课中' : '已归档'}
                </span>
              </div>

              {/* Specifications Block */}
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">学段年级：</span>
                  <span className="font-medium">{selectedClass.grade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">班级学生数：</span>
                  <span className="font-semibold">{selectedClass.studentCount} 人</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">班主任：</span>
                  <span className="font-medium">{selectedClass.headTeacher}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">语文学科教师：</span>
                  <span className="font-medium">{selectedClass.chineseTeacher}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">教材版本：</span>
                  <span className="font-medium">{selectedClass.textbookVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">默认收发作业：</span>
                  <span className="font-mono font-medium">每天早上 {selectedClass.defaultSubmitTime}</span>
                </div>
              </div>

              {/* Representatives lists */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">班级课代表</span>
                <div className="space-y-1.5">
                  {students.filter(s => selectedClass.representatives.includes(s.id)).map(rep => (
                    <div key={rep.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-zinc-800/20">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{rep.name}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">已激活</span>
                    </div>
                  ))}
                  {selectedClass.representatives.length === 0 && (
                    <span className="text-xs text-slate-400 block italic">未指定课代表，点击编辑设置。</span>
                  )}
                </div>
              </div>

              {/* Action buttons drawer */}
              <div className="space-y-2.5 pt-4 border-t border-slate-150 dark:border-zinc-800">
                <button
                  onClick={() => onEnterClassroom(selectedClass.id)}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 shadow-sm active:scale-98 cursor-pointer"
                >
                  进入虚拟教室视图
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenEditModal(selectedClass)}
                    className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1 active:scale-98 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    编辑班级
                  </button>
                  <button
                    onClick={() => onArchiveClass(selectedClass.id)}
                    className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1 active:scale-98 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {selectedClass.status === 'active' ? '归档班级' : '取消归档'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-2 h-full">
              <Users className="w-12 h-12 stroke-1 text-slate-300" />
              <p className="text-sm">未选择班级</p>
              <p className="text-xs">点击左侧表格中的一行班级，在此处查看完整教学档案和快捷管理选项。</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal (Combined rendering) */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in border border-slate-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {showAddModal ? '新建班级' : '编辑班级信息'}
              </h3>
              <button 
                onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-850 cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">班级名称</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="如：七年级 5 班"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">年级</label>
                  <select
                    value={formData.grade || '七年级'}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  >
                    <option>七年级</option>
                    <option>八年级</option>
                    <option>九年级</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">班主任姓名</label>
                  <input
                    type="text"
                    value={formData.headTeacher || ''}
                    onChange={(e) => setFormData({ ...formData, headTeacher: e.target.value })}
                    placeholder="如：马老师"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">教材版本</label>
                  <input
                    type="text"
                    value={formData.textbookVersion || ''}
                    onChange={(e) => setFormData({ ...formData, textbookVersion: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">默认收取时间</label>
                  <input
                    type="time"
                    value={formData.defaultSubmitTime || '08:00'}
                    onChange={(e) => setFormData({ ...formData, defaultSubmitTime: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">预计学生人数</label>
                  <input
                    type="number"
                    value={formData.studentCount || 40}
                    onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) || 40 })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">指派课代表</label>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
                  <div className="flex flex-wrap gap-2 min-h-8">
                    {(formData.representatives || []).length ? (formData.representatives || []).map(id => {
                      const student = students.find(s => s.id === id);
                      if (!student) return null;
                      return (
                        <span key={id} className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                          {student.name}
                        </span>
                      );
                    }) : <span className="text-xs text-slate-400">暂未指派课代表</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRepPicker(true)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    选择课代表
                  </button>
                </div>
              </div>
            </div>

            {showRepPicker && (
              <div className="fixed inset-0 z-[70] bg-slate-900/35 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="glass-panel rounded-3xl p-5 w-full max-w-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-50">选择课代表</h3>
                    <button onClick={() => setShowRepPicker(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={repSearch}
                      onChange={(e) => setRepSearch(e.target.value)}
                      placeholder="搜索学生姓名或学号"
                      className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto grid grid-cols-2 gap-2">
                    {students
                      .filter(s => {
                        const targetClassId = formData.id && classes.some(c => c.id === formData.id) ? formData.id : selectedClassId;
                        return targetClassId ? s.classId === targetClassId : true;
                      })
                      .filter(s => !repSearch || `${s.name}${s.studentNo}`.includes(repSearch))
                      .map(student => {
                        const isRep = (formData.representatives || []).includes(student.id);
                        return (
                          <button
                            type="button"
                            key={student.id}
                            onClick={() => toggleRepresentative(student.id)}
                            className={`p-3 rounded-2xl border text-left transition-all ${isRep ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300'}`}
                          >
                            <span className="block text-sm font-black">{student.name}</span>
                            <span className={`block text-[10px] mt-1 ${isRep ? 'text-white/70' : 'text-slate-400'}`}>{student.studentNo}</span>
                          </button>
                        );
                      })}
                  </div>
                  <button onClick={() => setShowRepPicker(false)} className="w-full py-2.5 rounded-2xl bg-emerald-700 text-white text-xs font-bold">
                    确认选择
                  </button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                className="px-4 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={showAddModal ? handleSaveAdd : handleSaveEdit}
                className="px-4 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl cursor-pointer"
              >
                保存班级资料
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
