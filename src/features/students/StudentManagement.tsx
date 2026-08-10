/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Users, UserPlus, FileSpreadsheet, Edit, Trash2, Tag,
  ArrowLeftRight, Filter, Search, X, Eye, HelpCircle, Award, Sparkles
} from 'lucide-react';
import { Student, SchoolClass, StudentStatus, ParentInfo, RosterStudent } from '../../domain/types';
import { RosterImportResult } from '../../services/rosterApi';

interface StudentManagementProps {
  students: RosterStudent[];
  classes: SchoolClass[];
  onAddStudent: (newStudent: Student) => Promise<boolean>;
  onUpdateStudent: (updatedStudent: Student) => Promise<boolean>;
  onDeleteStudent: (studentId: string) => void;
  onBulkImport: (
    classId: string,
    rows: { studentNo: string; name: string; gender?: 'male' | 'female' }[]
  ) => Promise<RosterImportResult>;
  onBulkMoveClass: (studentIds: string[], targetClassId: string) => void;
  onBulkAddTags: (studentIds: string[], tags: string[]) => void;
  targetStudentId?: string | null;
  onTargetStudentHandled?: () => void;
}

export default function StudentManagement({
  students,
  classes,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkImport,
  onBulkMoveClass,
  onBulkAddTags,
  targetStudentId,
  onTargetStudentHandled
}: StudentManagementProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportToast, setShowImportToast] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importRejectedCount, setImportRejectedCount] = useState(0);
  const [importClassId, setImportClassId] = useState('c5');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [otherRelation, setOtherRelation] = useState('');

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
  const familyAttentionTags = ['留守儿童', '双职工家庭', '隔代教养', '单亲家庭', '重组家庭', '家长期望较高', '作业陪伴不足', '沟通需谨慎'];
  const relationOptions = ['母亲', '父亲', '姥姥', '奶奶', '姥爷', '爷爷', '其他'];
  const dailyBehaviorTags = ['课堂积极', '注意力易分散', '作业拖延', '书写认真', '情绪敏感', '同伴关系良好'];
  const selectedFamilyTags = (formData.familyStatusTag || '').split('、').filter(Boolean);
  const selectedBehaviorTags = formData.behaviorTags || [];

  useEffect(() => {
    if (!targetStudentId) return;
    const targetStudent = students.find(student => student.id === targetStudentId);
    if (!targetStudent) return;

    setSelectedClassId(targetStudent.classId);
    setSearchQuery('');
    setSelectedStudentId(targetStudent.id);
    onTargetStudentHandled?.();
  }, [onTargetStudentHandled, students, targetStudentId]);

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
    const defaultClassId = selectedClassId === 'all'
      ? classes.find(item => item.id === 'c5' && item.status === 'active')?.id ?? classes.find(item => item.status === 'active')?.id ?? ''
      : selectedClassId;
    setIsEditMode(false);
    setOtherRelation('');
    setFormData({
      id: 's' + (students.length + 1),
      name: '',
      studentNo: '',
      classId: defaultClassId,
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
    setOtherRelation(relationOptions.includes(s.parent.relation) ? '' : s.parent.relation);
    setFormData({ ...s });
    setShowAddEditModal(true);
  };

  const handleSaveStudent = async () => {
    if (!formData.name || !formData.studentNo || !formData.classId) {
      alert('请填写学生姓名、班内学号并选择班级。');
      return;
    }
    const currentClass = classes.find(c => c.id === formData.classId);
    const normalizedParent = {
      ...formData.parent,
      relation: formData.parent?.relation === '其他' && otherRelation.trim()
        ? otherRelation.trim()
        : formData.parent?.relation || '父亲'
    } as ParentInfo;
    const updated = {
      ...formData,
      parent: normalizedParent,
      className: currentClass ? currentClass.name : ''
    } as Student;

    const saved = isEditMode
      ? await onUpdateStudent(updated)
      : await onAddStudent(updated);
    if (saved) setShowAddEditModal(false);
  };

  const handleOpenImport = () => {
    const targetClassId = selectedClassId === 'all'
      ? classes.find(item => item.id === 'c5' && item.status === 'active')?.id ?? classes.find(item => item.status === 'active')?.id ?? ''
      : selectedClassId;
    setImportClassId(targetClassId);
    setImportText('');
    setImportError(null);
    setShowImportModal(true);
  };

  const handleImport = async () => {
    const lines = importText.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    const dataLines = lines[0]?.includes('学号') ? lines.slice(1) : lines;
    const rows: { studentNo: string; name: string; gender?: 'male' | 'female' }[] = [];
    for (let index = 0; index < dataLines.length; index += 1) {
      const line = dataLines[index];
      const columns = line.split(line.includes('\t') ? '\t' : ',').map(item => item.trim());
      if (columns.length < 2 || !columns[0] || !columns[1]) {
        setImportError(`第 ${index + 1} 行缺少学号或姓名`);
        return;
      }
      const gender = columns[2] === '女' || columns[2]?.toLowerCase() === 'female'
        ? 'female' as const
        : columns[2] === '男' || columns[2]?.toLowerCase() === 'male'
          ? 'male' as const
          : undefined;
      rows.push({ studentNo: columns[0], name: columns[1], gender });
    }
    if (!rows.length) {
      setImportError('请至少输入一名学生。');
      return;
    }
    setIsImporting(true);
    setImportError(null);
    try {
      const result = await onBulkImport(importClassId, rows);
      setImportCount(result.imported.length);
      setImportRejectedCount(result.rejected.length);
      setShowImportModal(false);
      setShowImportToast(true);
      setTimeout(() => setShowImportToast(false), 4000);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '名册导入失败');
    } finally {
      setIsImporting(false);
    }
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
    <div className="flex flex-col gap-4 min-h-full" id="student-mgmt-page">
      
      {/* Table Section */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        
        {/* Header toolbar */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 glass-panel rounded-2xl p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 min-w-0">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              学生管理
            </h2>
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
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
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="student-class-filter"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">所有班级</option>
                {classes.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenImport}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-zinc-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              批量导入名册
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

        {/* Desktop and tablet roster */}
        <div className="hidden md:block glass-panel rounded-2xl overflow-hidden flex-1">
          <table className="w-full table-auto text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[11px] font-bold text-slate-400 border-b border-slate-100 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === filteredStudents.length && filteredStudents.length > 0}
                    onChange={handleSelectAll}
                    className="accent-emerald-700"
                    aria-label="选择当前列表全部学生"
                  />
                </th>
                <th className="px-3 py-3 whitespace-nowrap">学生</th>
                <th className="px-3 py-3 whitespace-nowrap">班级</th>
                <th className="px-3 py-3 whitespace-nowrap">性别</th>
                <th className="px-3 py-3 whitespace-nowrap">在班状态</th>
                <th className="px-3 py-3 whitespace-nowrap">学情状态</th>
                <th className="px-3 py-3">日常表现</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/40 text-xs">
              {filteredStudents.map(student => {
                const isSelected = selectedStudentId === student.id;
                const isRowChecked = selectedRows.includes(student.id);
                return (
                  <tr
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer ${isSelected ? 'bg-emerald-600/5 dark:bg-emerald-500/5' : ''}`}
                  >
                    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isRowChecked}
                        onChange={() => handleSelectRow(student.id)}
                        className="accent-emerald-700"
                        aria-label={`选择 ${student.name}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{student.name}</span>
                        {student.isRepresentative && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded">课代表</span>
                        )}
                      </div>
                      <span className="block mt-0.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">{student.studentNo}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{student.className}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{student.gender === 'male' ? '男' : '女'}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                        {student.enrollmentStatus === 'active' ? '在班' : student.enrollmentStatus === 'suspended' ? '暂缓' : '已离班'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{getStatusBadge(student.status)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {student.behaviorTags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-slate-500 text-[10px] whitespace-nowrap">{tag}</span>
                        ))}
                        {student.behaviorTags.length > 2 && <span className="text-[10px] text-slate-400">+{student.behaviorTags.length - 2}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">未找到符合筛选条件的学生。</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile roster */}
        <div className="md:hidden glass-panel rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
          {filteredStudents.map(student => (
            <div key={student.id} className="flex items-start gap-3 p-4">
              <input
                type="checkbox"
                checked={selectedRows.includes(student.id)}
                onChange={() => handleSelectRow(student.id)}
                className="mt-1 accent-emerald-700"
                aria-label={`选择 ${student.name}`}
              />
              <button type="button" onClick={() => setSelectedStudentId(student.id)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 whitespace-nowrap">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{student.name}</span>
                    {student.isRepresentative && <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded">课代表</span>}
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                    {student.enrollmentStatus === 'active' ? '在班' : student.enrollmentStatus === 'suspended' ? '暂缓' : '已离班'}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span className="font-mono">{student.studentNo}</span>
                  <span>{student.className}</span>
                  <span>{student.gender === 'male' ? '男' : '女'}</span>
                  <span>{student.status === 'outstanding' ? '表现突出' : student.status === 'warning' ? '需要关注' : student.status === 'risk' ? '近期风险' : '状态良好'}</span>
                </div>
              </button>
            </div>
          ))}
          {filteredStudents.length === 0 && <div className="px-6 py-12 text-center text-sm text-slate-400">未找到符合筛选条件的学生。</div>}
        </div>
      </div>

      {selectedStudent && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedStudentId(null)} aria-label="关闭学生详情" />
          <aside role="dialog" aria-modal="true" aria-label={`${selectedStudent.name}的学生详情`} className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-fade-in">
            <div className="shrink-0 flex items-start justify-between gap-4 p-5 border-b border-slate-100 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{selectedStudent.name}</h3>
                  {selectedStudent.isRepresentative && <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded">课代表</span>}
                </div>
                <p className="mt-1 text-xs font-mono text-slate-400">{selectedStudent.studentNo}</p>
              </div>
              <button type="button" onClick={() => setSelectedStudentId(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800" aria-label="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5" id="student-mgmt-drawer">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-lg text-xs text-slate-600 dark:text-slate-300">
                <div><span className="text-slate-400">所属班级</span><p className="mt-1 font-semibold">{selectedStudent.className}</p></div>
                <div><span className="text-slate-400">性别</span><p className="mt-1 font-semibold">{selectedStudent.gender === 'male' ? '男' : '女'}</p></div>
                <div><span className="text-slate-400">在班状态</span><p className="mt-1 font-semibold">{selectedStudent.enrollmentStatus === 'active' ? '在班' : selectedStudent.enrollmentStatus === 'suspended' ? '暂缓' : '已离班'}</p></div>
                <div><span className="text-slate-400">学情状态</span><div className="mt-1">{getStatusBadge(selectedStudent.status)}</div></div>
              </div>

              <section className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400">家长联系信息</h4>
                {selectedStudent.parent.name || selectedStudent.parent.phone || selectedStudent.parent.remark ? (
                  <div className="p-3 border border-slate-200 dark:border-zinc-800 rounded-lg space-y-2 text-xs">
                    <div className="flex flex-wrap justify-between gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <span>{selectedStudent.parent.name || '未填写姓名'}{selectedStudent.parent.relation ? `（${selectedStudent.parent.relation}）` : ''}</span>
                      <span className="font-mono text-slate-500">{selectedStudent.parent.phone || '未填写电话'}</span>
                    </div>
                    {selectedStudent.parent.remark && <p className="p-2 bg-amber-500/5 rounded text-[11px] text-slate-500">{selectedStudent.parent.remark}</p>}
                  </div>
                ) : <p className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-lg text-xs text-slate-400">尚未录入家长联系信息</p>}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400">日常表现标签</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedStudent.behaviorTags.length
                    ? selectedStudent.behaviorTags.map(tag => <span key={tag} className="px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-xs text-slate-600 dark:text-slate-300">{tag}</span>)
                    : <span className="text-xs text-slate-400">暂无标签</span>}
                </div>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20"><h4 className="font-bold text-emerald-800 dark:text-emerald-300">学科优势</h4><p className="mt-2 text-slate-600 dark:text-slate-300">{selectedStudent.strongKnowledge.join('、') || '暂无记录'}</p></div>
                <div className="p-3 rounded-lg bg-rose-50/70 dark:bg-rose-950/20"><h4 className="font-bold text-rose-800 dark:text-rose-300">学科短板</h4><p className="mt-2 text-slate-600 dark:text-slate-300">{selectedStudent.weakKnowledge.join('、') || '暂无记录'}</p></div>
              </section>
            </div>
            <div className="shrink-0 grid grid-cols-2 gap-2 p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => { handleOpenEdit(selectedStudent); setSelectedStudentId(null); }}
                className="py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
              >
                <Edit className="w-4 h-4" />修改档案
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`确定要归档/删除学生 ${selectedStudent.name} 吗？`)) {
                    onDeleteStudent(selectedStudent.id);
                    setSelectedStudentId(null);
                  }
                }}
                className="py-2.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />移出名册
              </button>
            </div>
          </aside>
        </>
      )}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">批量导入学生名册</h3>
              <button type="button" onClick={() => setShowImportModal(false)} className="p-1 text-slate-400 hover:text-slate-600" aria-label="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">目标班级</label>
              <select
                value={importClassId}
                onChange={(event) => setImportClassId(event.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm"
              >
                {classes.filter(item => item.status === 'active').map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">名册内容</label>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={'学号\t姓名\t性别\n05\t张三\t男\n06\t李四\t女'}
                rows={10}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-mono text-sm resize-y"
              />
              <p className="text-[11px] text-slate-400">可直接粘贴 Excel 三列，也支持逗号分隔；性别列可省略。</p>
            </div>
            {importError && <p className="text-xs font-semibold text-red-600">{importError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowImportModal(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold">取消</button>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={isImporting || !importClassId}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {isImporting ? '正在导入...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roster Import Toast Notification */}
      {showImportToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900/90 dark:bg-emerald-950/90 text-white backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 z-50 animate-fade-in border border-emerald-500/20">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <div className="text-xs">
            <span className="font-bold block text-emerald-400">名册导入完成</span>
            <span>成功导入 <b>{importCount}</b> 人{importRejectedCount ? `，${importRejectedCount} 行未导入` : ''}。</span>
          </div>
          <button onClick={() => setShowImportToast(false)} className="text-white/60 hover:text-white ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div role="dialog" aria-modal="true" aria-label={isEditMode ? '修改学生档案' : '录入新学生档案'} className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-150 dark:border-zinc-800 max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
            <div className="shrink-0 flex justify-between items-center p-5 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isEditMode ? '修改学生档案' : '录入新学生档案'}
              </h3>
              <button onClick={() => setShowAddEditModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800" aria-label="关闭编辑弹窗">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              <div className="grid sm:grid-cols-2 gap-4">
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
                    onChange={(e) => setFormData({
                      ...formData,
                      classId: e.target.value,
                      isRepresentative: e.target.value === formData.classId ? formData.isRepresentative : false
                    })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 focus:outline-none"
                  >
                    {classes.filter(c => c.status === 'active').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
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
                      <span>男</span>
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="radio"
                        checked={formData.gender === 'female'}
                        onChange={() => setFormData({ ...formData, gender: 'female' })}
                        className="accent-emerald-700"
                      />
                      <span>女</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Parent fields */}
              <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">家长联系信息</span>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
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
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500">关系</label>
                      <select
                        value={relationOptions.includes(formData.parent?.relation || '') ? formData.parent?.relation : '其他'}
                        onChange={(e) => {
                          if (e.target.value !== '其他') setOtherRelation('');
                          setFormData({
                            ...formData,
                            parent: { ...formData.parent, relation: e.target.value } as ParentInfo
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border"
                      >
                        {relationOptions.map(option => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                      {(formData.parent?.relation === '其他' || !relationOptions.includes(formData.parent?.relation || '')) && (
                        <input
                          type="text"
                          value={otherRelation}
                          onChange={(e) => setOtherRelation(e.target.value)}
                          placeholder="请输入具体关系"
                          className="w-full mt-2 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border"
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">家校沟通随记</label>
                    <textarea
                      value={formData.parent?.remark || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        parent: { ...formData.parent, remark: e.target.value } as ParentInfo
                      })}
                      placeholder="沟通时间及关键诉求"
                      rows={9}
                      className="w-full h-full min-h-[168px] px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border resize-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500">家庭关注类型</label>
                  <div className="flex flex-wrap gap-2">
                    {familyAttentionTags.map(tag => {
                      const checked = selectedFamilyTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const next = checked
                              ? selectedFamilyTags.filter(item => item !== tag)
                              : [...selectedFamilyTags, tag];
                            setFormData({ ...formData, familyStatusTag: next.join('、'), familyStatus: next.length ? 'attention' : 'normal' });
                          }}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                            checked
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">日常表现标签</label>
                <div className="flex flex-wrap gap-2">
                  {dailyBehaviorTags.map(tag => {
                    const checked = selectedBehaviorTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const next = checked
                            ? selectedBehaviorTags.filter(item => item !== tag)
                            : [...selectedBehaviorTags, tag];
                          setFormData({ ...formData, behaviorTags: next });
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                          checked
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Representatives / Status */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">课表职责</label>
                  <label className="flex items-center gap-1.5 pt-2">
                    <input
                      type="checkbox"
                      checked={formData.isRepresentative || false}
                      onChange={(e) => setFormData({ ...formData, isRepresentative: e.target.checked })}
                      className="accent-emerald-700"
                    />
                    <span className="text-xs">设为课代表</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">日常表现评估</label>
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
            <div className="shrink-0 flex justify-end gap-3 p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                onClick={() => setShowAddEditModal(false)}
                className="px-4 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={() => void handleSaveStudent()}
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

