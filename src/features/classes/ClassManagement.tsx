import React, { useMemo, useState } from 'react';
import { Archive, ArrowRight, Edit, Plus, Search, ShieldCheck, Users, X } from 'lucide-react';
import { CommitteeAssignment, CommitteeRole, SchoolClass, Student } from '../../domain/types';

type NewClass = Omit<SchoolClass, 'id' | 'studentCount'>;

interface Props {
  classes: SchoolClass[];
  students: Student[];
  committeeRoles: CommitteeRole[];
  onAddClass: (value: NewClass) => Promise<boolean>;
  onUpdateClass: (value: SchoolClass) => Promise<boolean>;
  onArchiveClass: (id: string) => void;
  onEnterClassroom: (id: string) => void;
  onSaveCommitteeAssignments: (classId: string, values: Omit<CommitteeAssignment, 'classId'>[]) => Promise<void>;
}

const emptyClass = (): Partial<SchoolClass> => ({
  name: '', grade: '七年级', term: '2026 春季学期', headTeacher: '', studentCount: 0, status: 'active'
});

const fieldClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-base focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 sm:text-sm';

export default function ClassManagement({ classes, students, committeeRoles, onAddClass, onUpdateClass, onArchiveClass, onEnterClassroom, onSaveCommitteeAssignments }: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SchoolClass>>(emptyClass);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [showCommittee, setShowCommittee] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [savingCommittee, setSavingCommittee] = useState(false);
  const [savingClass, setSavingClass] = useState(false);
  const [formError, setFormError] = useState('');
  const selectedClass = classes.find(item => item.id === selectedClassId);
  const classStudents = useMemo(() => selectedClass ? students.filter(student => student.classId === selectedClass.id) : [], [selectedClass, students]);

  const openForm = (mode: 'add' | 'edit', value?: SchoolClass) => {
    setFormData(value ? { ...value } : emptyClass());
    setFormError('');
    setModalMode(mode);
  };

  const saveClass = async () => {
    if (!formData.name?.trim() || !formData.headTeacher?.trim()) {
      setFormError('请填写班级名称与班主任姓名。');
      return;
    }
    const common = {
      name: formData.name.trim(),
      grade: formData.grade ?? '七年级',
      term: formData.term?.trim() || '2026 春季学期',
      headTeacher: formData.headTeacher.trim(),
      status: formData.status ?? 'active'
    } satisfies NewClass;
    setSavingClass(true);
    setFormError('');
    try {
      const succeeded = modalMode === 'add'
        ? await onAddClass(common)
        : await onUpdateClass({ ...common, id: formData.id!, studentCount: formData.studentCount ?? 0 });
      if (succeeded) setModalMode(null);
      else setFormError('班级保存失败，请检查信息后重试。');
    } finally {
      setSavingClass(false);
    }
  };

  const openCommittee = () => {
    setDraft(Object.fromEntries(classStudents.map(student => [student.id, student.committeeRoleIds])));
    setSearch('');
    setShowCommittee(true);
  };
  const toggleRole = (studentId: string, roleId: string) => setDraft(current => {
    const roles = current[studentId] ?? [];
    return { ...current, [studentId]: roles.includes(roleId) ? roles.filter(id => id !== roleId) : [...roles, roleId] };
  });
  const saveCommittee = async () => {
    if (!selectedClass) return;
    setSavingCommittee(true);
    try {
      await onSaveCommitteeAssignments(selectedClass.id, Object.keys(draft).flatMap(studentId => (draft[studentId] ?? []).map(roleId => ({ studentId, roleId }))));
      setShowCommittee(false);
    } finally {
      setSavingCommittee(false);
    }
  };

  return <div className="flex h-full flex-col gap-6 animate-fade-in 2xl:flex-row" id="class-mgmt-page">
    <div className="flex min-w-0 flex-1 flex-col space-y-4">
      <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-base font-bold"><Users className="h-5 w-5 text-emerald-700" />班级管理</h2><p className="mt-1 text-sm text-slate-500">维护班级基础信息，并在班级详情中委派班委。</p></div><button id="add-class-btn" onClick={() => openForm('add')} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" />新建班级</button></div>
      <div className="glass-panel overflow-hidden rounded-3xl">{classes.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-600 dark:text-slate-300"><thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/50"><tr><th className="px-6 py-4">班级名称</th><th className="px-6 py-4">学期</th><th className="px-6 py-4">年级</th><th className="px-6 py-4">班主任</th><th className="px-6 py-4">班委</th><th className="px-6 py-4 text-right">状态</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-zinc-800/40">{classes.map(value => { const count = students.filter(student => student.classId === value.id && student.committeeRoleIds.length).length; return <tr key={value.id} onClick={() => setSelectedClassId(value.id)} className={`cursor-pointer hover:bg-slate-50/60 ${selectedClassId === value.id ? 'bg-emerald-600/5' : ''}`}><td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">{value.name}</td><td className="px-6 py-4">{value.term}</td><td className="px-6 py-4">{value.grade}</td><td className="px-6 py-4">{value.headTeacher}</td><td className="px-6 py-4">{count ? `${count} 人任职` : '暂未委派'}</td><td className="px-6 py-4 text-right"><span className={`rounded-full px-2 py-1 text-xs font-bold ${value.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{value.status === 'active' ? '授课中' : '已归档'}</span></td></tr>; })}</tbody></table></div> : <div className="grid min-h-64 place-items-center px-4 py-10 text-center"><div className="max-w-sm"><Users className="mx-auto h-10 w-10 text-emerald-700" /><h3 className="mt-4 text-lg font-black">先创建第一个班级</h3><p className="mt-2 text-sm leading-6 text-slate-500">班级建立后即可导入学生、安排座位并逐步形成学情诊断。</p><button onClick={() => openForm('add')} className="mt-5 min-h-11 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white">创建班级</button></div></div>}</div>
    </div>
    <aside className={`w-full flex-shrink-0 2xl:w-[360px] ${selectedClass ? '' : 'hidden 2xl:flex'}`}><div className="glass-panel flex h-full min-h-[440px] w-full flex-col rounded-3xl p-5">{selectedClass ? <><div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><h3 className="text-lg font-bold">{selectedClass.name}</h3><p className="text-sm text-slate-500">{selectedClass.term}</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">{selectedClass.studentCount} 人</span></div><div className="grid grid-cols-2 gap-3 py-4 text-sm"><Info label="年级" value={selectedClass.grade} /><Info label="班主任" value={selectedClass.headTeacher} /></div><section className="flex-1 space-y-3 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><h4 className="flex items-center gap-1.5 text-xs font-black text-slate-500"><ShieldCheck className="h-4 w-4" />班委体系</h4><button onClick={openCommittee} className="min-h-11 rounded-lg border border-emerald-200 px-3 text-xs font-bold text-emerald-700">委派/编辑班委</button></div><div className="space-y-2">{committeeRoles.map(role => { const assigned = classStudents.filter(student => student.committeeRoleIds.includes(role.id)); return assigned.length ? <div key={role.id} className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/50"><span className="text-xs font-bold text-slate-500">{role.name}</span><p className="mt-1 text-sm font-semibold">{assigned.map(student => student.name).join('、')}</p></div> : null; })}{!classStudents.some(student => student.committeeRoleIds.length) && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">暂未委派班委</p>}</div></section><div className="space-y-2.5 border-t border-slate-100 pt-4"><button onClick={() => onEnterClassroom(selectedClass.id)} className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-emerald-700 text-sm font-semibold text-white">进入虚拟教室<ArrowRight className="h-4 w-4" /></button><div className="grid grid-cols-2 gap-2"><button onClick={() => openForm('edit', selectedClass)} className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-slate-100 text-sm"><Edit className="h-3.5 w-3.5" />编辑班级</button><button onClick={() => onArchiveClass(selectedClass.id)} className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-slate-100 text-sm"><Archive className="h-3.5 w-3.5" />{selectedClass.status === 'active' ? '归档班级' : '取消归档'}</button></div></div></> : <div className="grid flex-1 place-items-center text-sm text-slate-400">选择一个班级查看详情</div>}</div></aside>
    {modalMode && <Modal onClose={() => !savingClass && setModalMode(null)}><div className="flex items-center justify-between"><h3 className="text-lg font-bold">{modalMode === 'add' ? '新建班级' : '编辑班级信息'}</h3><button onClick={() => setModalMode(null)} disabled={savingClass} aria-label="关闭" className="grid min-h-11 min-w-11 place-items-center"><X className="h-5 w-5" /></button></div><div className="grid gap-4 sm:grid-cols-2"><Field label="班级名称"><input value={formData.name ?? ''} onChange={event => setFormData({ ...formData, name: event.target.value })} placeholder="如：初一（10）班" className={fieldClass} /></Field><Field label="年级"><select value={formData.grade ?? '七年级'} onChange={event => setFormData({ ...formData, grade: event.target.value })} className={fieldClass}><option>七年级</option><option>八年级</option><option>九年级</option></select></Field><Field label="学期"><input value={formData.term ?? ''} onChange={event => setFormData({ ...formData, term: event.target.value })} className={fieldClass} /></Field><Field label="班主任"><input value={formData.headTeacher ?? ''} onChange={event => setFormData({ ...formData, headTeacher: event.target.value })} className={fieldClass} /></Field>{modalMode === 'edit' && <Field label="当前名册人数"><div className={`${fieldClass} font-semibold`}>{formData.studentCount ?? 0} 人</div></Field>}</div>{formError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}<Actions cancel={() => setModalMode(null)} save={() => void saveClass()} label={savingClass ? '保存中…' : '保存班级资料'} disabled={savingClass} /></Modal>}
    {showCommittee && selectedClass && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900"><div className="flex items-center justify-between border-b p-5"><div><h3 className="font-black">委派班委 · {selectedClass.name}</h3><p className="text-sm text-slate-500">支持一人多职，也支持同一职位多人担任。</p></div><button onClick={() => setShowCommittee(false)} aria-label="关闭" className="grid min-h-11 min-w-11 place-items-center"><X className="h-5 w-5" /></button></div><div className="border-b p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索姓名或学号" className={`${fieldClass} pl-9`} /></div></div><div className="flex-1 overflow-y-auto p-4"><div className="space-y-2">{classStudents.filter(student => !search || `${student.name}${student.studentNo}`.includes(search)).map(student => <div key={student.id} className="grid gap-3 rounded-2xl border p-3 md:grid-cols-[180px_1fr]"><div><p className="font-bold">{student.name}</p><p className="text-xs text-slate-400">{student.studentNo}</p></div><div className="flex flex-wrap gap-2">{committeeRoles.map(role => { const selected = (draft[student.id] ?? []).includes(role.id); return <button key={role.id} onClick={() => toggleRole(student.id, role.id)} className={`min-h-11 rounded-full border px-3 text-xs font-bold ${selected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 text-slate-500'}`}>{role.name}</button>; })}</div></div>)}</div></div><div className="flex justify-end gap-2 border-t p-4"><button onClick={() => setShowCommittee(false)} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm">取消</button><button disabled={savingCommittee} onClick={() => void saveCommittee()} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{savingCommittee ? '保存中…' : '保存班委任职'}</button></div></div></div>}
  </div>;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" className="my-auto w-full max-w-lg space-y-5 rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 sm:p-6">{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1"><span className="block text-xs font-bold text-slate-500">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div><span className="text-slate-400">{label}</span><p className="mt-1 font-semibold">{value}</p></div>; }
function Actions({ cancel, save, label, disabled }: { cancel: () => void; save: () => void; label: string; disabled?: boolean }) { return <div className="flex justify-end gap-2"><button onClick={cancel} disabled={disabled} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm disabled:opacity-50">取消</button><button onClick={save} disabled={disabled} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{label}</button></div>; }
