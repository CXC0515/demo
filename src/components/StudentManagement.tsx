/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, UserPlus, Upload, FileSpreadsheet, Edit, Trash2, Tag, 
  ArrowLeftRight, Filter, Search, X, Check, Eye, HelpCircle, Award, Sparkles 
} from 'lucide-react';
import { Student, SchoolClass, StudentStatus, ParentInfo } from '../types';

interface StudentManagementProps {
  students: Student[];
  classes: SchoolClass[];
  onAddStudent: (newStudent: Student) => void;
  onUpdateStudent: (updatedStudent: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onBulkImport: (importedStudents: Student[]) => void;
  onBulkMoveClass: (studentIds: string[], targetClassId: string) => void;
  onBulkAddTags: (studentIds: string[], tags: string[]) => void;
}

export default function StudentManagement({
  students,
  classes,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkImport,
  onBulkMoveClass,
  onBulkAddTags
}: StudentManagementProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [showImportToast, setShowImportToast] = useState(false);
  const [importCount, setImportCount] = useState(0);

  // Form states for Student add/edit
  const [formData, setFormData] = useState<Partial<Student>>({
    name: '',
    studentNo: '',
    classId: 'c1',
    gender: 'male',
    isRepresentative: false,
    status: 'good',
    behaviorTags: [],
    parent: { name: '', phone: '', relation: '父亲', remark: '' },
    familyStatus: 'normal',
    observationHistory: [],
    strongKnowledge: [],
    weakKnowledge: [],
    recentHomeworkTrend: [85, 85, 85, 85, 85],
    homeworkHistory: []
  });

  const [bulkTargetClass, setBulkTargetClass] = useState('c1');
  const [bulkNewTag, setBulkNewTag] = useState('');

  // Filter students
  const filteredStudents = students.filter(s => {
    const matchesClass = selectedClassId === 'all' || s.classId === selectedClassId;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.studentNo.includes(searchQuery);
    return matchesClass && matchesSearch;
  });

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const getStatusBadge = (status: StudentStatus) => {
    switch (status) {
      case 'good':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">良好</span>;
      case 'outstanding':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 font-medium">优秀</span>;
      case 'warning':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-medium">关注</span>;
      case 'risk':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 font-medium">预警</span>;
    }
  };

  const handleSelectRow = (studentId: string) => {
    if (selectedRows.includes(studentId)) {
      setSelectedRows(selectedRows.filter(id => id !== studentId));
    } else {
      setSelectedRows([...selectedRows, studentId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.length === filteredStudents.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredStudents.map(s => s.id));
    }
  };

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setFormData({
      id: 's' + (students.length + 1),
      name: '',
      studentNo: '20260703' + String(students.length + 1).padStart(2, '0'),
      classId: selectedClassId === 'all' ? 'c1' : selectedClassId,
      gender: 'male',
      isRepresentative: false,
      status: 'good',
      behaviorTags: ['勤奋踏实'],
      parent: { name: '', phone: '', relation: '父亲', remark: '' },
      familyStatus: 'normal',
      observationHistory: [],
      strongKnowledge: ['散文阅读'],
      weakKnowledge: ['文言文虚词'],
      recentHomeworkTrend: [80, 82, 85, 80, 83],
      homeworkHistory: []
    });
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (s: Student) => {
    setIsEditMode(true);
    setFormData({ ...s });
    setShowAddEditModal(true);
  };

  const handleSaveStudent = () => {
    if (!formData.name || !formData.studentNo || !formData.parent?.name || !formData.parent?.phone) {
      alert('请填写完整的学生姓名、学号以及家长联系方式！');
      return;
    }
    const currentClass = classes.find(c => c.id === formData.classId);
    const updated = {
      ...formData,
      className: currentClass ? currentClass.name : ''
    } as Student;

    if (isEditMode) {
      onUpdateStudent(updated);
    } else {
      onAddStudent(updated);
    }
    setShowAddEditModal(false);
  };

  const handleSimulateBulkImport = () => {
    // Simulated bulk import from an Excel worksheet of 5 new students for Class 1
    const importPayload: Student[] = [
      {
        id: 's_imp1',
        name: '董小宛',
        studentNo: '2026070311',
        classId: 'c1',
        className: '七年级 3 班',
        gender: 'female',
        isRepresentative: false,
        status: 'good',
        behaviorTags: ['思维敏捷', '写作新颖'],
        parent: { name: '董国昌', phone: '13911112222', relation: '父亲', remark: '关心孩子古诗词素养。' },
        familyStatus: 'normal',
        observationHistory: [],
        strongKnowledge: ['主旨理解', '想象作文'],
        weakKnowledge: ['字词默写'],
        recentHomeworkTrend: [90, 88, 92, 95, 94],
        homeworkHistory: []
      },
      {
        id: 's_imp2',
        name: '李修齐',
        studentNo: '2026070312',
        classId: 'c1',
        className: '七年级 3 班',
        gender: 'male',
        isRepresentative: false,
        status: 'good',
        behaviorTags: ['课堂勤勉', '背诵迅速'],
        parent: { name: '李瑞', phone: '13633334444', relation: '母亲', remark: '希望语文成绩保持前十。' },
        familyStatus: 'normal',
        observationHistory: [],
        strongKnowledge: ['字词默写', '说明文阅读'],
        weakKnowledge: ['修辞手法鉴赏'],
        recentHomeworkTrend: [85, 88, 87, 89, 91],
        homeworkHistory: []
      }
    ];

    onBulkImport(importPayload);
    setImportCount(importPayload.length);
    setShowImportToast(true);
    setTimeout(() => {
      setShowImportToast(false);
    }, 4000);
  };

  const handleApplyBulkMove = () => {
    onBulkMoveClass(selectedRows, bulkTargetClass);
    setSelectedRows([]);
    setShowBulkMoveModal(false);
  };

  const handleApplyBulkTags = () => {
    if (!bulkNewTag.trim()) return;
    onBulkAddTags(selectedRows, [bulkNewTag.trim()]);
    setBulkNewTag('');
    setSelectedRows([]);
    setShowBulkTagModal(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-fade-in" id="student-mgmt-page">
      
      {/* Table Section */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        
        {/* Header toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 glass-panel rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              学生管理
            </h2>
            
            {/* Search Input */}
            <div className="relative w-48">
              <input
                id="student-search-input"
                type="text"
                placeholder="搜索学号、姓名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            {/* Class Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="student-class-filter"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">全班级</option>
                {classes.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateBulkImport}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-zinc-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              批量导入 Excel
            </button>
            <button
              id="add-student-btn"
              onClick={handleOpenAdd}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              添加学生
            </button>
          </div>
        </div>

        {/* Selected Rows Bulk Actions Bar */}
        {selectedRows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-emerald-700/10 border border-emerald-500/20 rounded-xl text-xs animate-fade-in">
            <span className="font-semibold text-emerald-800 dark:text-emerald-400">
              已选中 {selectedRows.length} 名学生
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkMoveModal(true)}
                className="px-2.5 py-1.5 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                批量调班
              </button>
              <button
                onClick={() => setShowBulkTagModal(true)}
                className="px-2.5 py-1.5 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                批量打标签
              </button>
              <button
                onClick={() => setSelectedRows([])}
                className="text-slate-400 hover:text-slate-600 ml-2"
              >
                清除选择
              </button>
            </div>
          </div>
        )}

        {/* Students list Table */}
        <div className="glass-panel rounded-3xl overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
                <tr>
                  <th className="px-5 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={handleSelectAll}
                      className="accent-emerald-750"
                    />
                  </th>
                  <th className="px-5 py-4">学生姓名</th>
                  <th className="px-5 py-4 font-mono">学号</th>
                  <th className="px-5 py-4">班级</th>
                  <th className="px-5 py-4">性别</th>
                  <th className="px-5 py-4">学情状态</th>
                  <th className="px-5 py-4">日常表现标签</th>
                  <th className="px-5 py-4">家长联系人</th>
                  <th className="px-5 py-4 text-right">家庭关注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/40 text-xs">
                {filteredStudents.map(s => {
                  const isSelected = selectedStudentId === s.id;
                  const isRowChecked = selectedRows.includes(s.id);

                  return (
                    <tr 
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-all cursor-pointer ${
                        isSelected ? 'bg-emerald-600/5 dark:bg-emerald-500/5' : ''
                      }`}
                    >
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isRowChecked}
                          onChange={() => handleSelectRow(s.id)}
                          className="accent-emerald-700"
                        />
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        {s.name}
                        {s.isRepresentative && (
                          <span className="px-1 bg-amber-100 text-amber-800 text-[9px] font-medium rounded">课代</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-400">{s.studentNo}</td>
                      <td className="px-5 py-3">{s.className}</td>
                      <td className="px-5 py-3">{s.gender === 'male' ? '男' : '女'}</td>
                      <td className="px-5 py-3">{getStatusBadge(s.status)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {s.behaviorTags.slice(0, 2).map((t, idx) => (
                            <span key={idx} className="px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-800 rounded text-slate-500 text-[10px] whitespace-nowrap">
                              {t}
                            </span>
                          ))}
                          {s.behaviorTags.length > 2 && (
                            <span className="text-[10px] text-slate-400">+{s.behaviorTags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">{s.parent.name} ({s.parent.relation})</td>
                      <td className="px-5 py-3 text-right">
                        {s.familyStatusTag ? (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 rounded font-semibold text-[10px]">
                            {s.familyStatusTag}
                          </span>
                        ) : (
                          <span className="text-slate-400">普通</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                      未找到符合筛选条件的学生。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Details Drawer */}
      <div className={`w-full lg:w-[350px] flex-shrink-0 flex flex-col ${selectedStudent ? '' : 'hidden lg:flex'}`}>
        <div className="flex-1 glass-panel rounded-3xl p-5 flex flex-col justify-between space-y-5 overflow-y-auto max-h-[85vh]">
          {selectedStudent ? (
            <div className="space-y-5 animate-fade-in" id="student-mgmt-drawer">
              
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {selectedStudent.name}
                  </h3>
                  <p className="text-xs text-slate-400">学号：{selectedStudent.studentNo}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(selectedStudent.status)}
                </div>
              </div>

              {/* Class & gender */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400">所属班级：</span>
                  <p className="font-semibold">{selectedStudent.className}</p>
                </div>
                <div>
                  <span className="text-slate-400">生理性别：</span>
                  <p className="font-medium">{selectedStudent.gender === 'male' ? '男生 (Male)' : '女生 (Female)'}</p>
                </div>
              </div>

              {/* Parent Details section */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">家长联系信息</span>
                <div className="p-3 border border-slate-150 dark:border-zinc-800 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                    <span>{selectedStudent.parent.name} ({selectedStudent.parent.relation})</span>
                    <span className="font-mono text-slate-500">{selectedStudent.parent.phone}</span>
                  </div>
                  <div className="p-2 bg-amber-500/5 rounded-lg text-slate-500 text-[11px]">
                    <span className="font-semibold block">沟通备注:</span>
                    <p className="italic">“{selectedStudent.parent.remark}”</p>
                  </div>
                </div>
              </div>

              {/* Daily Performance parameters */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">日常表现评估</span>
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>课堂参与：</span>
                    <span className="font-medium px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded">活跃/高频发言</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>作业完成习惯：</span>
                    <span className={`font-medium px-2 py-0.5 rounded ${
                      selectedStudent.status === 'risk' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
                    }`}>
                      {selectedStudent.status === 'risk' ? '时常滞后、漏交' : '良好/准时'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>情绪表现：</span>
                    <span className="font-medium">稳定 / 平稳</span>
                  </div>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/20 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">学科优势：</span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">✓ {selectedStudent.strongKnowledge.join('、') || '无明显优势'}</p>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 font-bold block mb-1">学科短板：</span>
                  <p className="text-red-700 dark:text-red-400 font-medium">✗ {selectedStudent.weakKnowledge.join('、') || '无明显短板'}</p>
                </div>
              </div>

              {/* Actions drawer */}
              <div className="space-y-2 pt-4 border-t border-slate-150 dark:border-zinc-800">
                <button
                  onClick={() => handleOpenEdit(selectedStudent)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 active:scale-98 cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                  修改学生档案
                </button>
                <button
                  onClick={() => {
                    if (confirm(`确定要归档/删除学生 ${selectedStudent.name} 吗？`)) {
                      onDeleteStudent(selectedStudent.id);
                      setSelectedStudentId(null);
                    }
                  }}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-700 dark:text-red-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 active:scale-98 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  删除该生记录
                </button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-2 h-full">
              <Users className="w-12 h-12 stroke-1 text-slate-300" />
              <p className="text-sm">未选择学生</p>
              <p className="text-xs">点击左侧表格中的一行学生，在此处查看完整的家校沟通、各维度日常表现，以及学习瓶颈等信息。</p>
            </div>
          )}
        </div>
      </div>

      {/* Excel Import Toast Notification */}
      {showImportToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900/90 dark:bg-emerald-950/90 text-white backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 z-50 animate-fade-in border border-emerald-500/20">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <div className="text-xs">
            <span className="font-bold block text-emerald-400">批量导入 Excel 成功！</span>
            <span>成功解析并导入了 <b>{importCount}</b> 位学生档案至七年级 3 班。</span>
          </div>
          <button onClick={() => setShowImportToast(false)} className="text-white/60 hover:text-white ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-150 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isEditMode ? '修改学生档案' : '录入新学生档案'}
              </h3>
              <button onClick={() => setShowAddEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">学生姓名</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="如：张三"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">所属班级</label>
                  <select
                    value={formData.classId || 'c1'}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  >
                    {classes.filter(c => c.status === 'active').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">学号</label>
                  <input
                    type="text"
                    value={formData.studentNo || ''}
                    onChange={(e) => setFormData({ ...formData, studentNo: e.target.value })}
                    placeholder="20260703xx"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">生理性别</label>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="radio"
                        checked={formData.gender === 'male'}
                        onChange={() => setFormData({ ...formData, gender: 'male' })}
                        className="accent-emerald-700"
                      />
                      <span>男生 (Male)</span>
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="radio"
                        checked={formData.gender === 'female'}
                        onChange={() => setFormData({ ...formData, gender: 'female' })}
                        className="accent-emerald-700"
                      />
                      <span>女生 (Female)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Parent fields */}
              <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">家长联系信息</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">家长姓名</label>
                    <input
                      type="text"
                      value={formData.parent?.name || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        parent: { ...formData.parent, name: e.target.value } as ParentInfo
                      })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">联系电话</label>
                    <input
                      type="text"
                      value={formData.parent?.phone || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        parent: { ...formData.parent, phone: e.target.value } as ParentInfo
                      })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">关系</label>
                    <select
                      value={formData.parent?.relation || '父亲'}
                      onChange={(e) => setFormData({
                        ...formData,
                        parent: { ...formData.parent, relation: e.target.value } as ParentInfo
                      })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border"
                    >
                      <option>父亲</option>
                      <option>母亲</option>
                      <option>爷爷</option>
                      <option>奶奶</option>
                      <option>其他监护人</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">家校沟通随记</label>
                    <input
                      type="text"
                      value={formData.parent?.remark || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        parent: { ...formData.parent, remark: e.target.value } as ParentInfo
                      })}
                      placeholder="沟通时间及关键诉求"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border"
                    />
                  </div>
                </div>
              </div>

              {/* Representatives / Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">课表职责</label>
                  <label className="flex items-center gap-1.5 pt-2">
                    <input
                      type="checkbox"
                      checked={formData.isRepresentative || false}
                      onChange={(e) => setFormData({ ...formData, isRepresentative: e.target.checked })}
                      className="accent-emerald-700"
                    />
                    <span className="text-xs">任语文课代表职责</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">初始学情诊断</label>
                  <select
                    value={formData.status || 'good'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  >
                    <option value="good">状态良好</option>
                    <option value="outstanding">表现突出</option>
                    <option value="warning">需要关注</option>
                    <option value="risk">近期风险</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => setShowAddEditModal(false)}
                className="px-4 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={handleSaveStudent}
                className="px-4 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl"
              >
                保存档案
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Move Modal */}
      {showBulkMoveModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              批量调班 
            </h3>
            <p className="text-xs text-slate-500">
              将选中的 {selectedRows.length} 名学生批量调入以下目标班级，自动更新课程体系和学情组别：
            </p>
            <select
              value={bulkTargetClass}
              onChange={(e) => setBulkTargetClass(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-xs"
            >
              {classes.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowBulkMoveModal(false)} className="px-3 py-1.5 text-xs bg-slate-100 rounded-lg">
                取消
              </button>
              <button onClick={handleApplyBulkMove} className="px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg">
                确认调动
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {showBulkTagModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              批量打标签
            </h3>
            <p className="text-xs text-slate-500">
              向选中的 {selectedRows.length} 名学生同步添加以下日常观察行为标签：
            </p>
            <input
              type="text"
              value={bulkNewTag}
              onChange={(e) => setBulkNewTag(e.target.value)}
              placeholder="如：文言文自律、默写积极、作文推荐..."
              className="w-full px-3 py-2 border rounded-xl text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowBulkTagModal(false)} className="px-3 py-1.5 text-xs bg-slate-100 rounded-lg">
                取消
              </button>
              <button onClick={handleApplyBulkTags} className="px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg">
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
