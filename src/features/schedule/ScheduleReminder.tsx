/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, Bell, CalendarDays, Check, FileScan, LayoutGrid, ListTodo, LoaderCircle, Plus, Settings2, Trash2, X } from 'lucide-react';
import { ScheduleItem, SchedulePeriod, SchoolClass, TimerReminder } from '../../domain/types';
import { importSchedule, ScheduleImportDraft } from '../../services/scheduleApi';

interface Props {
  schedule: ScheduleItem[]; reminders: TimerReminder[]; classes: SchoolClass[]; periods: SchedulePeriod[]; showWeekends: boolean;
  onOpenPeriodSettings: () => void;
  onAddScheduleItem: (item: ScheduleItem) => void | Promise<void>;
  onUpdateScheduleItem: (item: ScheduleItem) => void | Promise<void>;
  onDeleteScheduleItem: (id: string) => void | Promise<void>;
  onImportSchedule: (items: ScheduleItem[]) => Promise<void>;
  onAddReminder: (item: TimerReminder) => void | Promise<void>;
  onToggleReminderStatus: (id: string) => void | Promise<void>;
  onDeleteReminder: (id: string) => void | Promise<void>;
}
const defaultPeriods: SchedulePeriod[] = [
  ['第一节','08:00','08:45'],['第二节','08:55','09:40'],['第三节','10:00','10:45'],['第四节','10:55','11:40'],
  ['第五节','13:30','14:15'],['第六节','14:25','15:10'],['第七节','15:20','16:05'],['第八节','16:15','17:00']
].map(([label,startTime,endTime], index) => ({ period:index+1,label,startTime,endTime }));
const dayNames = ['周一','周二','周三','周四','周五','周六','周日'];
const fieldClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950';
const periodTime = (period: SchedulePeriod | undefined) => period ? `${period.startTime} - ${period.endTime}` : '待确认';
const emptySchedule = (scope: 'teacher'|'class', classId: string, className: string, day: number, period: number, periods: SchedulePeriod[]): ScheduleItem => ({ id:'', day, period, title:'', classId:scope==='class'?classId:'', className:scope==='class'?className:'', type:'class', time:periodTime(periods[period-1]), scope, teacherName:'' });
const emptyReminder = (): TimerReminder => ({ id:'', name:'', classId:'', className:'', time:'每周一 08:00', repeatRule:'每周一', status:'active', important:false, urgent:false, dueAt:'' });
const stableHash = (value: string) => Array.from(value).reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);
const createScheduleColorSlots = (keys: string[]) => {
  const slots = new Map<string, number>();
  const used = new Set<number>();
  [...new Set(keys.filter(Boolean))].sort().forEach(key => {
    let slot = Math.abs(stableHash(key)) % 12 + 1;
    while (used.has(slot) && used.size < 12) slot = slot % 12 + 1;
    used.add(slot);
    slots.set(key, slot);
  });
  return slots;
};

export default function ScheduleReminder(props: Props) {
  const activeClasses = props.classes.filter(item => item.status === 'active');
  const [section,setSection] = useState<'schedule'|'reminders'>('schedule');
  const [scope,setScope] = useState<'teacher'|'class'>('teacher');
  const [classId,setClassId] = useState(activeClasses[0]?.id??'');
  const [reminderView,setReminderView] = useState<'list'|'quadrant'>('quadrant');
  const [editingSchedule,setEditingSchedule] = useState<ScheduleItem|null>(null);
  const [editingReminder,setEditingReminder] = useState<TimerReminder|null>(null);
  const [showImport,setShowImport] = useState(false);
  const effectiveClassId = classId || activeClasses[0]?.id || '';
  const selectedClass = activeClasses.find(item=>item.id===effectiveClassId);
  const periods = props.periods.length ? props.periods : defaultPeriods;
  const visibleDays = props.showWeekends ? 7 : 5;
  const filtered = useMemo(()=>props.schedule.filter(item=>scope==='teacher' ? (item.scope??'teacher')==='teacher' : item.scope==='class'&&item.classId===effectiveClassId),[props.schedule,scope,effectiveClassId]);
  const itemMap = useMemo(()=>new Map(filtered.map(item=>[`${item.day}-${item.period}`,item])),[filtered]);
  const colorSlots = useMemo(() => createScheduleColorSlots(filtered.map(item => scope === 'teacher' ? item.classId || item.className : item.title.trim().toLocaleLowerCase())), [filtered, scope]);

  const saveCourse = async () => {
    if (!editingSchedule) return;
    const selected = activeClasses.find(item=>item.id===editingSchedule.classId);
    const defaultTitle = periods.find(period => period.period === editingSchedule.period)?.label ?? `第${editingSchedule.period}节`;
    const item = {...editingSchedule,title:editingSchedule.title.trim()||defaultTitle,className:selected?.name??editingSchedule.className,id:editingSchedule.id||crypto.randomUUID()};
    await (editingSchedule.id ? props.onUpdateScheduleItem(item) : props.onAddScheduleItem(item));
    setEditingSchedule(null);
  };
  const saveReminderItem = async () => {
    if (!editingReminder?.name.trim()) return;
    const selected = activeClasses.find(item=>item.id===editingReminder.classId);
    await props.onAddReminder({...editingReminder,className:selected?.name??'',id:editingReminder.id||crypto.randomUUID()});
    setEditingReminder(null);
  };
  return <div className="flex h-full min-h-0 flex-col gap-4 animate-fade-in" id="schedule-page">
    <header className="flex shrink-0 border-b border-slate-200 pb-4 dark:border-zinc-800">
      <nav className="inline-flex w-fit rounded-xl bg-slate-100 p-1 dark:bg-zinc-900" aria-label="课表与提醒子页面"><Tab active={section==='schedule'} onClick={()=>setSection('schedule')} icon={CalendarDays}>课表</Tab><Tab active={section==='reminders'} onClick={()=>setSection('reminders')} icon={Bell}>提醒</Tab></nav>
    </header>
    {section==='schedule' ? <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-zinc-800"><button onClick={()=>setScope('teacher')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${scope==='teacher'?'bg-white text-emerald-800 shadow-sm dark:bg-zinc-700 dark:text-emerald-300':'text-slate-500'}`}>我的课表</button><button onClick={()=>setScope('class')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${scope==='class'?'bg-white text-emerald-800 shadow-sm dark:bg-zinc-700 dark:text-emerald-300':'text-slate-500'}`}>班级课表</button></div>
        {scope==='class'&&<select value={effectiveClassId} onChange={e=>setClassId(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-950">{activeClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <span className="text-xs text-slate-400">{props.showWeekends?'显示周一至周日':'显示周一至周五'}</span>
        <div className="ml-auto flex items-center gap-2"><button onClick={props.onOpenPeriodSettings} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-slate-300"><Settings2 className="h-4 w-4"/>设置课节时间</button><button onClick={()=>setShowImport(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><FileScan className="h-4 w-4"/>扫描导入</button></div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"><div style={{minWidth:`${150+visibleDays*142}px`}}>
        <div className="sticky top-0 z-20 grid border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-500 dark:border-zinc-800 dark:bg-zinc-950" style={{gridTemplateColumns:`150px repeat(${visibleDays},minmax(142px,1fr))`}}><div className="sticky left-0 z-30 bg-slate-50 px-4 py-3 text-left dark:bg-zinc-950">课节 / 时段</div>{dayNames.slice(0,visibleDays).map(day=><div key={day} className="border-l border-slate-200 px-3 py-3 dark:border-zinc-800">{day}</div>)}</div>
        {periods.map(period=><div key={period.period} className="grid min-h-[70px] border-b border-slate-100 last:border-b-0 dark:border-zinc-800" style={{gridTemplateColumns:`150px repeat(${visibleDays},minmax(142px,1fr))`}}><div className="sticky left-0 z-10 flex flex-col justify-center bg-slate-50/95 px-4 dark:bg-zinc-950/95"><strong className="text-xs">{period.label}</strong><span className="mt-1 font-mono text-[10px] text-slate-400">{periodTime(period)}</span></div>{Array.from({length:visibleDays},(_,di)=>{const item=itemMap.get(`${di+1}-${period.period}`);const colorKey=item?(scope==='teacher'?item.classId||item.className:item.title.trim().toLocaleLowerCase()):'';return <ScheduleCell key={di} item={item} scope={scope} colorSlot={colorSlots.get(colorKey)} onClick={()=>setEditingSchedule(item??emptySchedule(scope,effectiveClassId,selectedClass?.name??'',di+1,period.period,periods))}/>})}</div>)}
      </div></div>
    </section>:<ReminderWorkspace reminders={props.reminders} view={reminderView} onView={setReminderView} onAdd={()=>setEditingReminder(emptyReminder())} onToggle={props.onToggleReminderStatus} onDelete={props.onDeleteReminder}/>}
    {editingSchedule&&<ScheduleEditor item={editingSchedule} periods={periods} classes={activeClasses} onChange={setEditingSchedule} onClose={()=>setEditingSchedule(null)} onSave={()=>void saveCourse()} onDelete={editingSchedule.id?async()=>{await props.onDeleteScheduleItem(editingSchedule.id);setEditingSchedule(null)}:undefined}/>}
    {editingReminder&&<ReminderEditor item={editingReminder} classes={activeClasses} onChange={setEditingReminder} onClose={()=>setEditingReminder(null)} onSave={()=>void saveReminderItem()}/>}
    {showImport&&<ImportDialog scope={scope} classId={effectiveClassId} classes={activeClasses} periods={periods} onClose={()=>setShowImport(false)} onApply={items=>props.onImportSchedule(items.map(item=>({...item,time:periodTime(periods.find(period=>period.period===item.period))})))} />}
  </div>;
}

function Tab({active,onClick,icon:Icon,children}:{active:boolean;onClick:()=>void;icon:React.ElementType;children:React.ReactNode}) { return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold ${active?'bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white':'text-slate-500'}`}><Icon className="h-4 w-4"/>{children}</button>; }
function Modal({title,onClose,children,footer,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;footer:React.ReactNode;wide?:boolean}) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900 ${wide?'max-w-5xl':'max-w-2xl'}`}><div className="mb-4 flex items-center justify-between"><h3 className="font-black">{title}</h3><button onClick={onClose} aria-label="关闭"><X className="h-5 w-5 text-slate-400"/></button></div>{children}<div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">{footer}</div></div></div>; }

function ScheduleCell({item,scope,colorSlot,onClick}:{key?:React.Key;item:ScheduleItem|undefined;scope:'teacher'|'class';colorSlot:number|undefined;onClick:()=>void}) {
  if (!item) return <button onClick={onClick} className="min-w-0 border-l border-slate-100 p-1.5 text-left hover:bg-emerald-50/50 dark:border-zinc-800 dark:hover:bg-emerald-950/20"><span className="flex h-full items-center justify-center text-[10px] text-slate-300">＋ 安排</span></button>;
  const hasClass = Boolean(item.classId || item.className);
  const primary = scope === 'teacher' ? (hasClass ? item.className : item.title) : item.title;
  const secondary = scope === 'teacher' ? (hasClass ? item.title : '个人事项') : item.teacherName || '教师待补充';
  const lowConfidence = item.confidence !== undefined && item.confidence < .75;
  const style = !lowConfidence && colorSlot ? {
    backgroundColor:`hsl(var(--schedule-hue-${colorSlot}) / 0.13)`,
    borderColor:`hsl(var(--schedule-hue-${colorSlot}) / 0.38)`,
    color:`hsl(var(--schedule-hue-${colorSlot}))`
  } : undefined;
  return <button onClick={onClick} className="min-w-0 border-l border-slate-100 p-1.5 text-left hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"><span style={style} className={`flex h-full flex-col justify-center rounded-lg border px-2.5 py-2 ${lowConfidence?'border-amber-300 bg-amber-50 text-amber-900':colorSlot?'':'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-200'}`}><strong className="truncate text-sm">{primary}</strong><span className="mt-1 truncate text-[10px] opacity-75">{secondary}</span></span></button>;
}

function ScheduleEditor({item,periods,classes,onChange,onClose,onSave,onDelete}:{item:ScheduleItem;periods:SchedulePeriod[];classes:SchoolClass[];onChange:(item:ScheduleItem)=>void;onClose:()=>void;onSave:()=>void;onDelete?:()=>void}) { const defaultTitle=periods.find(period=>period.period===item.period)?.label??`第${item.period}节`;return <Modal title={item.id?'编辑课程':'安排课程'} onClose={onClose} footer={<><button onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500">取消</button>{onDelete&&<button onClick={onDelete} className="mr-auto rounded-lg px-3 py-2 text-xs font-bold text-red-600">删除</button>}<button onClick={onSave} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white">保存</button></>}><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500 sm:col-span-2">课程内容<input className={`${fieldClass} mt-1.5`} value={item.title} placeholder={`留空则使用“${defaultTitle}”`} onChange={e=>onChange({...item,title:e.target.value})}/></label><label className="text-xs font-bold text-slate-500">星期<select className={`${fieldClass} mt-1.5`} value={item.day} onChange={e=>onChange({...item,day:Number(e.target.value)})}>{dayNames.map((d,i)=><option key={d} value={i+1}>{d}</option>)}</select></label><label className="text-xs font-bold text-slate-500">课节<select className={`${fieldClass} mt-1.5`} value={item.period} onChange={e=>{const selectedPeriod=periods.find(period=>period.period===Number(e.target.value));onChange({...item,period:Number(e.target.value),time:periodTime(selectedPeriod)})}}>{periods.map(period=><option key={period.period} value={period.period}>{period.label}</option>)}</select></label><label className="text-xs font-bold text-slate-500">时间<input className={`${fieldClass} mt-1.5 bg-slate-50 text-slate-500 dark:bg-zinc-800`} value={periodTime(periods.find(period=>period.period===item.period))} readOnly/><span className="mt-1 block text-[10px] font-normal text-slate-400">统一在学校作息设置中调整</span></label>{item.scope==='teacher'?<label className="text-xs font-bold text-slate-500">上课班级<select className={`${fieldClass} mt-1.5`} value={item.classId} onChange={e=>onChange({...item,classId:e.target.value})}><option value="">无 / 个人事项</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>:<label className="text-xs font-bold text-slate-500">任课教师<input className={`${fieldClass} mt-1.5`} value={item.teacherName??''} onChange={e=>onChange({...item,teacherName:e.target.value})}/></label>}</div></Modal>; }

function ReminderWorkspace({reminders,view,onView,onAdd,onToggle,onDelete}:{reminders:TimerReminder[];view:'list'|'quadrant';onView:(v:'list'|'quadrant')=>void;onAdd:()=>void;onToggle:(id:string)=>void|Promise<void>;onDelete:(id:string)=>void|Promise<void>}) {
  const quadrants=[['重要且紧急',true,true,'border-rose-200 bg-rose-50/50'],['重要不紧急',true,false,'border-amber-200 bg-amber-50/50'],['紧急不重要',false,true,'border-blue-200 bg-blue-50/50'],['不重要不紧急',false,false,'border-slate-200 bg-slate-50/50']] as const;
  const card=(item:TimerReminder)=><article key={item.id} className={`rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900 ${item.status==='inactive'?'opacity-50':''}`}><div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-bold">{item.name}</h4><p className="mt-1 text-[10px] text-slate-500">{item.repeatRule} · {item.time}{item.className?` · ${item.className}`:''}</p></div><button onClick={()=>void onToggle(item.id)} className={`h-5 w-9 rounded-full p-0.5 ${item.status==='active'?'bg-emerald-600 text-right':'bg-slate-300 text-left'}`} aria-label="切换提醒状态"><span className="inline-block h-4 w-4 rounded-full bg-white"/></button></div><div className="mt-2 flex justify-end"><button onClick={()=>void onDelete(item.id)} aria-label="删除提醒"><Trash2 className="h-4 w-4 text-slate-400"/></button></div></article>;
  return <section className="min-h-0 flex-1"><div className="mb-3 flex flex-wrap items-center gap-2"><div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-zinc-900"><Tab active={view==='quadrant'} onClick={()=>onView('quadrant')} icon={LayoutGrid}>四象限</Tab><Tab active={view==='list'} onClick={()=>onView('list')} icon={ListTodo}>清单</Tab></div><button onClick={onAdd} className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white"><Plus className="h-4 w-4"/>新建提醒</button></div>{view==='list'?<div className="space-y-2">{reminders.map(card)}{!reminders.length&&<Empty/>}</div>:<div className="grid min-h-0 gap-3 md:grid-cols-2">{quadrants.map(([label,important,urgent,color])=><div key={label} className={`min-h-44 rounded-2xl border p-3 ${color} dark:border-zinc-800 dark:bg-zinc-900/50`}><h3 className="mb-3 text-xs font-black">{label}</h3><div className="space-y-2">{reminders.filter(item=>Boolean(item.important)===important&&Boolean(item.urgent)===urgent).map(card)}</div></div>)}</div>}</section>;
}
function Empty(){return <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">还没有提醒事项</div>}
function ReminderEditor({item,classes,onChange,onClose,onSave}:{item:TimerReminder;classes:SchoolClass[];onChange:(item:TimerReminder)=>void;onClose:()=>void;onSave:()=>void}) { return <Modal title="新建提醒" onClose={onClose} footer={<><button onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500">取消</button><button onClick={onSave} disabled={!item.name.trim()} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">保存提醒</button></>}><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500 sm:col-span-2">提醒事项<input className={`${fieldClass} mt-1.5`} value={item.name} onChange={e=>onChange({...item,name:e.target.value})}/></label><label className="text-xs font-bold text-slate-500">关联班级<select className={`${fieldClass} mt-1.5`} value={item.classId} onChange={e=>onChange({...item,classId:e.target.value})}><option value="">无</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-xs font-bold text-slate-500">提醒时间<input className={`${fieldClass} mt-1.5`} value={item.time} onChange={e=>onChange({...item,time:e.target.value})}/></label><label className="text-xs font-bold text-slate-500">重复规则<select className={`${fieldClass} mt-1.5`} value={item.repeatRule} onChange={e=>onChange({...item,repeatRule:e.target.value})}>{['一次性','每周一','每周二','每周三','每周四','每周五'].map(v=><option key={v}>{v}</option>)}</select></label><label className="text-xs font-bold text-slate-500">截止时间<input type="datetime-local" className={`${fieldClass} mt-1.5`} value={item.dueAt??''} onChange={e=>onChange({...item,dueAt:e.target.value})}/></label><div className="flex items-center gap-5 sm:col-span-2"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.important)} onChange={e=>onChange({...item,important:e.target.checked})} className="accent-emerald-700"/>重要</label><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.urgent)} onChange={e=>onChange({...item,urgent:e.target.checked})} className="accent-rose-600"/>紧急</label></div></div></Modal>; }

function ImportDialog({scope,classId,classes,periods,onClose,onApply}:{scope:'teacher'|'class';classId:string;classes:SchoolClass[];periods:SchedulePeriod[];onClose:()=>void;onApply:(items:ScheduleItem[])=>Promise<void>}) {
  const [file,setFile]=useState<File|null>(null);
  const [draft,setDraft]=useState<ScheduleImportDraft|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const recognize=async()=>{if(!file)return;setBusy(true);setError('');try{setDraft(await importSchedule(file,scope,classId))}catch(cause){setError(cause instanceof Error?cause.message:'SCHEDULE_IMPORT_FAILED')}finally{setBusy(false)}};
  const update=(index:number,patch:Partial<ScheduleItem>)=>setDraft(current=>current?{...current,items:current.items.map((item,i)=>i===index?{...item,...patch}:item)}:current);
  const remove=(index:number)=>setDraft(current=>current?{...current,items:current.items.filter((_,i)=>i!==index)}:current);
  const groupedDays=dayNames.map((day,dayIndex)=>({day,dayNumber:dayIndex+1,items:(draft?.items??[]).map((item,index)=>({item,index})).filter(entry=>entry.item.day===dayIndex+1).sort((left,right)=>left.item.period-right.item.period)})).filter(group=>group.items.length);
  const footer=draft?<button onClick={async()=>{setBusy(true);await onApply(draft.items);setBusy(false);onClose()}} disabled={busy||!draft.items.length} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>}确认写入 {draft.items.length} 项</button>:<button onClick={()=>void recognize()} disabled={!file||busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<FileScan className="h-4 w-4"/>}开始识别</button>;
  return <Modal wide title="扫描纸质课表" onClose={onClose} footer={footer}>{!draft?<div className="space-y-4"><label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center dark:border-zinc-700 dark:bg-zinc-950"><FileScan className="mb-3 h-8 w-8 text-emerald-700"/><strong className="text-sm">上传课表照片或 PDF</strong><span className="mt-1 text-xs text-slate-400">图片先在本地增强，再由 PaddleOCR 与 AI 生成草稿</span><input type="file" accept="image/*,application/pdf" className="sr-only" onChange={e=>setFile(e.target.files?.[0]??null)}/>{file&&<span className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-bold dark:bg-zinc-900">{file.name}</span>}</label>{error&&<p className="flex items-center gap-1.5 rounded-lg bg-red-50 p-3 text-xs text-red-700"><AlertCircle className="h-4 w-4"/>{error}</p>}</div>:<div className="space-y-3"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><strong>AI 识别草稿</strong>：已按星期和课节排列；黄色项目需要重点检查。</div>{draft.warnings.map(w=><p key={w} className="text-xs text-amber-700">• {w}</p>)}<div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">{groupedDays.map(group=><section key={group.dayNumber} className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700"><header className="flex items-center justify-between bg-slate-100 px-3 py-2 dark:bg-zinc-800"><strong className="text-sm">{group.day}</strong><span className="text-[10px] text-slate-400">{group.items.length} 项</span></header><div className="divide-y divide-slate-100 dark:divide-zinc-800">{group.items.map(({item,index})=><ImportDraftRow key={item.id} item={item} index={index} scope={scope} classes={classes} periods={periods} onUpdate={update} onRemove={remove}/>)}</div></section>)}</div></div>}</Modal>;
}

function ImportDraftRow({item,index,scope,classes,periods,onUpdate,onRemove}:{key?:React.Key;item:ScheduleItem;index:number;scope:'teacher'|'class';classes:SchoolClass[];periods:SchedulePeriod[];onUpdate:(index:number,patch:Partial<ScheduleItem>)=>void;onRemove:(index:number)=>void}) {
  const lowConfidence=item.confidence!==undefined&&item.confidence<.75;
  return <div className={`grid gap-3 p-3 md:grid-cols-[190px_minmax(150px,1fr)_minmax(170px,1fr)_32px] ${lowConfidence?'bg-amber-50 dark:bg-amber-950/20':'bg-white dark:bg-zinc-900'}`}><div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-[10px] font-bold text-slate-400">星期<select value={item.day} onChange={event=>onUpdate(index,{day:Number(event.target.value)})} className={`${fieldClass} mt-1 min-w-[82px]`}>{dayNames.map((day,dayIndex)=><option key={day} value={dayIndex+1}>{day}</option>)}</select></label><label className="min-w-0 text-[10px] font-bold text-slate-400">课节<select value={item.period} onChange={event=>{const selectedPeriod=periods.find(period=>period.period===Number(event.target.value));onUpdate(index,{period:Number(event.target.value),time:periodTime(selectedPeriod)})}} className={`${fieldClass} mt-1 min-w-[96px]`}>{periods.map(period=><option key={period.period} value={period.period}>{period.label}</option>)}</select></label></div><label className="text-[10px] font-bold text-slate-400">课程<input value={item.title} onChange={event=>onUpdate(index,{title:event.target.value})} className={`${fieldClass} mt-1`} /></label>{scope==='teacher'?<label className="text-[10px] font-bold text-slate-400">班级<select value={item.classId} onChange={event=>onUpdate(index,{classId:event.target.value,className:classes.find(itemClass=>itemClass.id===event.target.value)?.name??''})} className={`${fieldClass} mt-1`}><option value="">班级待确认</option>{classes.map(itemClass=><option key={itemClass.id} value={itemClass.id}>{itemClass.name}</option>)}</select></label>:<label className="text-[10px] font-bold text-slate-400">教师<input value={item.teacherName??''} onChange={event=>onUpdate(index,{teacherName:event.target.value})} className={`${fieldClass} mt-1`} placeholder="教师待确认"/></label>}<button onClick={()=>onRemove(index)} className="self-end rounded-lg p-2 hover:bg-red-50 dark:hover:bg-red-950/30" aria-label="移除识别项"><Trash2 className="h-4 w-4 text-slate-400"/></button></div>;
}
