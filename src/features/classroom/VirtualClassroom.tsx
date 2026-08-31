/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  Check,
  Download,
  GraduationCap,
  LoaderCircle,
  LogOut,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  X
} from 'lucide-react';
import { ClassroomLayout, SchoolClass, Student } from '../../domain/types';
import { exportClassroomLayout, getClassroomLayout, saveClassroomLayout } from '../../services/classroomApi';

interface VirtualClassroomProps {
  students: Student[];
  classes: SchoolClass[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onManageStudent: (studentId: string) => void;
  onViewStudentProfile: (studentId: string) => void;
  onAddObservation: (studentId: string, text: string) => Promise<void>;
}

const statusMeta: Record<Student['status'], { label: string; dot: string; badge: string }> = {
  outstanding: { label: '表现突出', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  good: { label: '状态良好', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warning: { label: '需要关注', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  risk: { label: '近期风险', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' }
};

const cloneLayout = (layout: ClassroomLayout): ClassroomLayout => ({
  ...layout,
  seats: layout.seats.map(seat => ({ ...seat }))
});

export default function VirtualClassroom({
  students,
  classes,
  selectedClassId,
  onSelectClass,
  onManageStudent,
  onViewStudentProfile,
  onAddObservation
}: VirtualClassroomProps) {
  const [layout, setLayout] = useState<ClassroomLayout | null>(null);
  const [draft, setDraft] = useState<ClassroomLayout | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [placementStudentId, setPlacementStudentId] = useState<string | null>(null);
  const [observationText, setObservationText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submittingObservation, setSubmittingObservation] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const classStudents = useMemo(
    () => students
      .filter(student => student.classId === selectedClassId)
      .sort((left, right) => left.studentNo.localeCompare(right.studentNo, 'zh-CN', { numeric: true })),
    [selectedClassId, students]
  );
  const studentById = useMemo(() => new Map(classStudents.map(student => [student.id, student])), [classStudents]);
  const activeClass = classes.find(schoolClass => schoolClass.id === selectedClassId) ?? classes[0];
  const activeLayout = draft ?? layout;
  const editMode = Boolean(draft);
  const seatedStudentIds = useMemo(
    () => new Set((activeLayout?.seats ?? []).map(seat => seat.studentId)),
    [activeLayout]
  );
  const unassignedStudents = classStudents.filter(student => !seatedStudentIds.has(student.id));
  const selectedStudent = selectedStudentId ? studentById.get(selectedStudentId) : undefined;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLayout(null);
    setDraft(null);
    setSelectedStudentId(null);
    setPlacementStudentId(null);
    setMessage(null);
    getClassroomLayout(selectedClassId)
      .then(nextLayout => {
        if (active) setLayout(nextLayout);
      })
      .catch(error => {
        if (active) setMessage({ type: 'error', text: `座位表读取失败：${error instanceof Error ? error.message : '未知错误'}` });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedStudent || editMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedStudentId(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editMode, selectedStudent]);

  const updateDraftSeats = (seats: ClassroomLayout['seats']) => {
    setDraft(current => current ? { ...current, seats } : current);
  };

  const handleSeatClick = (seatIndex: number) => {
    if (!activeLayout) return;
    const occupantId = activeLayout.seats.find(seat => seat.seatIndex === seatIndex)?.studentId;
    if (!editMode) {
      if (occupantId) setSelectedStudentId(occupantId);
      return;
    }
    if (!placementStudentId) {
      if (occupantId) {
        setPlacementStudentId(occupantId);
        setSelectedStudentId(occupantId);
      }
      return;
    }
    if (occupantId === placementStudentId) {
      setPlacementStudentId(null);
      return;
    }

    const sourceSeat = activeLayout.seats.find(seat => seat.studentId === placementStudentId);
    const nextSeats = activeLayout.seats
      .filter(seat => seat.studentId !== placementStudentId && seat.seatIndex !== seatIndex)
      .map(seat => ({ ...seat }));
    if (sourceSeat && occupantId) nextSeats.push({ seatIndex: sourceSeat.seatIndex, studentId: occupantId });
    nextSeats.push({ seatIndex, studentId: placementStudentId });
    updateDraftSeats(nextSeats.sort((left, right) => left.seatIndex - right.seatIndex));
    setSelectedStudentId(placementStudentId);
    setPlacementStudentId(null);
    setMessage(null);
  };

  const removePlacementStudent = () => {
    if (!activeLayout || !placementStudentId) return;
    updateDraftSeats(activeLayout.seats.filter(seat => seat.studentId !== placementStudentId));
    setPlacementStudentId(null);
  };

  const resizeLayout = (nextRows: number, nextColumns: number) => {
    if (!draft || nextRows < 1 || nextRows > 10 || nextColumns < 1 || nextColumns > 12) return;
    const converted = draft.seats.map(seat => {
      const row = Math.floor(seat.seatIndex / draft.columnCount);
      const column = seat.seatIndex % draft.columnCount;
      return { ...seat, row, column };
    });
    if (converted.some(seat => seat.row >= nextRows || seat.column >= nextColumns)) {
      setMessage({ type: 'error', text: '缩小布局前请先移出边界位置上的学生。' });
      return;
    }
    setDraft({
      ...draft,
      rowCount: nextRows,
      columnCount: nextColumns,
      seats: converted.map(({ row, column, studentId }) => ({ seatIndex: row * nextColumns + column, studentId }))
    });
    setMessage(null);
  };

  const autoArrange = () => {
    if (!draft) return;
    updateDraftSeats(classStudents
      .slice(0, draft.rowCount * draft.columnCount)
      .map((student, seatIndex) => ({ seatIndex, studentId: student.id })));
    setPlacementStudentId(null);
    if (classStudents.length > draft.rowCount * draft.columnCount) {
      setMessage({ type: 'error', text: '座位数量不足，部分学生仍在待安排列表中。' });
    } else {
      setMessage(null);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveClassroomLayout(draft);
      setLayout(saved);
      setDraft(null);
      setPlacementStudentId(null);
      setMessage({ type: 'success', text: '座位表已保存。' });
    } catch (error) {
      setMessage({ type: 'error', text: `保存失败：${error instanceof Error ? error.message : '未知错误'}` });
    } finally {
      setSaving(false);
    }
  };

  const submitObservation = async () => {
    if (!selectedStudent || !observationText.trim()) return;
    setSubmittingObservation(true);
    setMessage(null);
    try {
      await onAddObservation(selectedStudent.id, observationText.trim());
      setObservationText('');
      setMessage({ type: 'success', text: `已保存 ${selectedStudent.name} 的课堂观察。` });
    } catch (error) {
      setMessage({ type: 'error', text: `观察记录保存失败：${error instanceof Error ? error.message : '未知错误'}` });
    } finally {
      setSubmittingObservation(false);
    }
  };

  const exportLayout = async () => {
    setExporting(true);
    setMessage(null);
    try {
      await exportClassroomLayout(selectedClassId, activeClass.name);
      setMessage({ type: 'success', text: '座位表已导出。' });
    } catch (error) {
      setMessage({ type: 'error', text: `导出失败：${error instanceof Error ? error.message : '未知错误'}` });
    } finally {
      setExporting(false);
    }
  };

  const unassignedPanel = (
    <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">待安排学生</h3>
        <span className="text-xs text-slate-400">{unassignedStudents.length}</span>
      </div>
      <div className="max-h-56 space-y-1.5 overflow-y-auto">
        {unassignedStudents.map(student => (
          <button
            type="button"
            key={student.id}
            onClick={() => setPlacementStudentId(current => current === student.id ? null : student.id)}
            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left ${placementStudentId === student.id ? 'border-amber-400 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}
          >
            <span className="truncate text-sm font-semibold text-slate-700">{student.name}</span>
            <span className="ml-2 text-xs text-slate-400">{student.studentNo}</span>
          </button>
        ))}
        {!unassignedStudents.length && <p className="py-4 text-center text-xs text-slate-400">全部学生已安排</p>}
      </div>
      {placementStudentId && seatedStudentIds.has(placementStudentId) && (
        <button type="button" onClick={removePlacementStudent} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
          <LogOut className="h-4 w-4" />移出座位
        </button>
      )}
      {placementStudentId && (
        <button type="button" onClick={() => setPlacementStudentId(null)} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-slate-500">
          <RotateCcw className="h-4 w-4" />取消选择
        </button>
      )}
    </section>
  );

  if (!activeClass) return null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 animate-fade-in" id="classroom-page">
      <header className="flex shrink-0 flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <GraduationCap className="h-5 w-5 text-emerald-700" />
            {activeClass.name}座位图
          </h2>
          <p className="mt-1 text-xs text-slate-500">已安排 {activeLayout?.seats.length ?? 0} 人 · 待安排 {unassignedStudents.length} 人</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedClassId}
            onChange={event => onSelectClass(event.target.value)}
            className="h-9 min-w-32 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200"
            aria-label="切换班级"
          >
            {classes.filter(schoolClass => schoolClass.status === 'active').map(schoolClass => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>
          {editMode ? (
            <>
              <button
                type="button"
                onClick={() => { setDraft(null); setPlacementStudentId(null); setMessage(null); }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300"
              >
                <X className="h-4 w-4" />取消
              </button>
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存座位
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void exportLayout()}
                disabled={!layout || exporting}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200"
              >
                {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                导出 Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!layout) return;
                  setSelectedStudentId(null);
                  setDraft(cloneLayout(layout));
                }}
                disabled={!layout}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <BookOpen className="h-4 w-4" />编辑座位
              </button>
            </>
          )}
        </div>
      </header>

      {message && (
        <div className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {message.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {loading || !activeLayout ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-slate-500">
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />读取座位表
        </div>
      ) : (
        <div className={`grid min-h-0 flex-1 gap-5 ${editMode ? 'overflow-y-auto xl:grid-cols-[minmax(0,1fr)_340px] xl:overflow-hidden' : 'overflow-hidden'}`}>
          {editMode && <div className="xl:hidden">{unassignedPanel}</div>}
          <section className="flex min-h-0 min-w-0 flex-col gap-3">
            {editMode && (
              <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-slate-500">行数</span>
                <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                  <button type="button" title="减少一行" onClick={() => resizeLayout(draft.rowCount - 1, draft.columnCount)} className="p-2 text-slate-600"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-8 border-x border-slate-200 px-2 py-2 text-center text-xs font-bold">{draft.rowCount}</span>
                  <button type="button" title="增加一行" onClick={() => resizeLayout(draft.rowCount + 1, draft.columnCount)} className="p-2 text-slate-600"><Plus className="h-4 w-4" /></button>
                </div>
                <span className="text-xs font-semibold text-slate-500">列数</span>
                <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                  <button type="button" title="减少一列" onClick={() => resizeLayout(draft.rowCount, draft.columnCount - 1)} className="p-2 text-slate-600"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-8 border-x border-slate-200 px-2 py-2 text-center text-xs font-bold">{draft.columnCount}</span>
                  <button type="button" title="增加一列" onClick={() => resizeLayout(draft.rowCount, draft.columnCount + 1)} className="p-2 text-slate-600"><Plus className="h-4 w-4" /></button>
                </div>
                <button type="button" onClick={autoArrange} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                  <Sparkles className="h-4 w-4 text-amber-500" />按学号排列
                </button>
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 sm:p-4">
              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
                <div
                  className="grid h-full"
                  style={{
                    gridTemplateColumns: '24px minmax(0, 1fr)',
                    gridTemplateRows: 'minmax(0, 1fr) 20px',
                    columnGap: '8px',
                    rowGap: '5px',
                    minWidth: `${activeLayout.columnCount * 94 + 32}px`
                  }}
                >
                  <div
                    className="grid min-h-0 text-[10px] font-semibold text-slate-400"
                    style={{ gridTemplateRows: `repeat(${activeLayout.rowCount}, minmax(0, 1fr))`, rowGap: '6px' }}
                    aria-hidden="true"
                  >
                    {Array.from({ length: activeLayout.rowCount }, (_, visualRow) => (
                      <span key={visualRow} className="flex items-center justify-center">{activeLayout.rowCount - visualRow}</span>
                    ))}
                  </div>
                  <div
                    className="grid min-h-0"
                    style={{
                      gridTemplateColumns: `repeat(${activeLayout.columnCount}, minmax(74px, 1fr))`,
                      gridTemplateRows: `repeat(${activeLayout.rowCount}, minmax(0, 1fr))`,
                      columnGap: 'clamp(12px, 2vw, 24px)',
                      rowGap: '6px'
                    }}
                  >
                    {Array.from({ length: activeLayout.rowCount * activeLayout.columnCount }, (_, visualIndex) => {
                      const visualRow = Math.floor(visualIndex / activeLayout.columnCount);
                      const column = visualIndex % activeLayout.columnCount;
                      const logicalRow = activeLayout.rowCount - 1 - visualRow;
                      const seatIndex = logicalRow * activeLayout.columnCount + column;
                      const assignment = activeLayout.seats.find(seat => seat.seatIndex === seatIndex);
                      const student = assignment ? studentById.get(assignment.studentId) : undefined;
                      const isPlacement = student?.id === placementStudentId;
                      return (
                        <button
                          type="button"
                          key={seatIndex}
                          onClick={() => handleSeatClick(seatIndex)}
                          className={`relative flex min-h-0 overflow-hidden rounded-md border p-1.5 text-center transition-colors ${
                            student
                              ? isPlacement
                                ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                                : 'border-slate-200 bg-white hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900'
                              : editMode
                                ? 'border-dashed border-slate-300 bg-white/60 hover:border-emerald-400 hover:bg-emerald-50/50'
                                : 'cursor-default border-dashed border-slate-200 bg-transparent'
                          }`}
                          aria-label={student ? `第${logicalRow + 1}行第${column + 1}列，${student.name}，${student.studentNo}` : `第${logicalRow + 1}行第${column + 1}列，空位`}
                        >
                          {student ? (
                            <span className="m-auto flex min-w-0 flex-col items-center justify-center leading-tight">
                              <span className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${statusMeta[student.status].dot}`} />
                              <span className="max-w-full truncate text-xs font-bold text-slate-800 dark:text-slate-100">{student.name}</span>
                              <span className="mt-0.5 text-[10px] text-slate-400">{student.studentNo}</span>
                              {student.isRepresentative && <Award className="absolute bottom-1 right-1.5 h-3.5 w-3.5 text-amber-500" aria-label="课代表" />}
                            </span>
                          ) : (
                            <span className="m-auto text-[11px] text-slate-400">空位</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <span aria-hidden="true" />
                  <div
                    className="grid text-[10px] font-semibold text-slate-400"
                    style={{ gridTemplateColumns: `repeat(${activeLayout.columnCount}, minmax(74px, 1fr))`, columnGap: 'clamp(12px, 2vw, 24px)' }}
                    aria-hidden="true"
                  >
                    {Array.from({ length: activeLayout.columnCount }, (_, column) => (
                      <span key={column} className="text-center">{column + 1}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mx-auto my-3 flex h-9 w-36 shrink-0 items-center justify-center rounded-sm border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-900">讲台</div>
              <div className="mx-auto flex h-11 min-w-80 max-w-3xl shrink-0 items-center justify-center rounded-sm bg-slate-800 text-xs font-semibold text-white">黑板</div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              {(Object.keys(statusMeta) as Student['status'][]).map(status => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusMeta[status].dot}`} />
                  {statusMeta[status].label} {classStudents.filter(student => student.status === status).length}
                </span>
              ))}
            </div>
          </section>

          {editMode && <aside className="hidden min-w-0 xl:block">{unassignedPanel}</aside>}
        </div>
      )}

      {selectedStudent && !editMode && createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]"
            onClick={() => setSelectedStudentId(null)}
            aria-label="关闭学生画像"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedStudent.name}的学生画像`}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:max-w-md dark:bg-zinc-900"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-zinc-800">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-800">{selectedStudent.name[0]}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <h3 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{selectedStudent.name}</h3>
                    {selectedStudent.isRepresentative && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        <Award className="h-3 w-3" />课代表
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-mono text-slate-400">{selectedStudent.studentNo} · {selectedStudent.className}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedStudentId(null)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800" aria-label="关闭">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-xs dark:bg-zinc-800/40">
                <div><span className="text-slate-400">学情状态</span><p className="mt-1"><span className={`inline-flex rounded border px-2 py-1 font-semibold ${statusMeta[selectedStudent.status].badge}`}>{statusMeta[selectedStudent.status].label}</span></p></div>
                <div><span className="text-slate-400">在班状态</span><p className="mt-2 font-semibold text-slate-700 dark:text-slate-200">{selectedStudent.enrollmentStatus === 'active' ? '在班' : selectedStudent.enrollmentStatus === 'suspended' ? '暂缓' : '已离班'}</p></div>
              </div>

              <section>
                <h4 className="mb-2 text-xs font-bold text-slate-500">日常表现</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStudent.behaviorTags.map(tag => <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-zinc-800 dark:text-slate-300">{tag}</span>)}
                  {!selectedStudent.behaviorTags.length && <span className="text-xs text-slate-400">暂无记录</span>}
                </div>
              </section>

              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-emerald-50/70 p-3 text-xs dark:bg-emerald-950/20">
                  <h4 className="font-bold text-emerald-800 dark:text-emerald-300">学科优势</h4>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">{selectedStudent.strongKnowledge.join('、') || '暂无记录'}</p>
                </div>
                <div className="rounded-md bg-rose-50/70 p-3 text-xs dark:bg-rose-950/20">
                  <h4 className="font-bold text-rose-800 dark:text-rose-300">学科短板</h4>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">{selectedStudent.weakKnowledge.join('、') || '暂无记录'}</p>
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-xs font-bold text-slate-500">最新课堂观察</h4>
                {selectedStudent.observationHistory[0] ? (
                  <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 dark:bg-zinc-800/40 dark:text-slate-300">
                    <p>{selectedStudent.observationHistory[0].content}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{selectedStudent.observationHistory[0].date} · {selectedStudent.observationHistory[0].author}</p>
                  </div>
                ) : <p className="text-xs text-slate-400">暂无观察记录</p>}
              </section>

              <section className="space-y-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
                <label htmlFor="classroom-observation" className="text-xs font-bold text-slate-500">新增课堂观察</label>
                <textarea
                  id="classroom-observation"
                  value={observationText}
                  onChange={event => setObservationText(event.target.value)}
                  placeholder="课堂观察"
                  className="h-24 w-full resize-none rounded-md border border-slate-200 p-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => void submitObservation()}
                  disabled={!observationText.trim() || submittingObservation}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submittingObservation && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  保存观察
                </button>
              </section>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => { setSelectedStudentId(null); onManageStudent(selectedStudent.id); }}
                className="rounded-md border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:text-slate-200"
              >
                学生管理
              </button>
              <button
                type="button"
                onClick={() => { setSelectedStudentId(null); onViewStudentProfile(selectedStudent.id); }}
                className="rounded-md bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white dark:bg-emerald-700"
              >
                查看完整画像
              </button>
            </div>
          </aside>
        </>,
        document.body
      )}
    </div>
  );
}
