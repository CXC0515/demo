import React, { useState } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { SchoolClass } from '../../domain/types';
import { RosterImportField, RosterImportGrid, RosterImportMapping, RosterImportPreview, RosterImportResult } from '../../services/rosterApi';

interface Props {
  classes: SchoolClass[];
  initialClassId: string;
  onClose: () => void;
  onPreview: (classId: string, grid: RosterImportGrid) => Promise<RosterImportPreview>;
  onImport: (classId: string, grid: RosterImportGrid) => Promise<RosterImportResult>;
  onComplete: (result: RosterImportResult) => void;
}

const fields: { value: RosterImportField; label: string }[] = [
  { value:'studentNo', label:'学号' }, { value:'name', label:'学生姓名' }, { value:'gender', label:'性别' },
  { value:'parentName', label:'家长姓名' }, { value:'parentPhone', label:'家长手机' },
  { value:'parentRelation', label:'与学生关系' }, { value:'parentRemark', label:'家长备注' }
];

const parseText = (text: string): RosterImportGrid => {
  const lines=text.split(/\r?\n/).filter(line=>line.trim());
  const separator=lines[0]?.includes('\t')?'\t':',';
  const parsed=lines.map(line=>line.split(separator).map(value=>value.trim()));
  return { headers:parsed[0]??[], rows:parsed.slice(1) };
};

export default function RosterImportDialog({ classes, initialClassId, onClose, onPreview, onImport, onComplete }:Props){
  const [classId,setClassId]=useState(initialClassId);
  const [text,setText]=useState('');
  const [grid,setGrid]=useState<RosterImportGrid|null>(null);
  const [preview,setPreview]=useState<RosterImportPreview|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  const requestPreview=async(nextGrid:RosterImportGrid)=>{if(!nextGrid.headers.length||!nextGrid.rows.length){setError('请提供包含表头和数据行的表格。');return}setBusy(true);setError('');try{const result=await onPreview(classId,nextGrid);setGrid({...nextGrid,mapping:result.mapping});setPreview(result)}catch(reason){setError(reason instanceof Error?reason.message:'无法解析导入内容')}finally{setBusy(false)}};
  const updateMapping=async(index:number,value:string)=>{if(!grid)return;const mapping={...(grid.mapping??{}),[index]:value===''?null:value as RosterImportField};const next={...grid,mapping};await requestPreview(next)};
  const readExcel=async(file:File)=>{setBusy(true);setError('');try{const ExcelJS=await import('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(new Uint8Array(await file.arrayBuffer()) as any);const sheet=workbook.worksheets[0];if(!sheet)throw new Error('工作簿中没有可读取的工作表');const rows:string[][]=[];sheet.eachRow({includeEmpty:false},row=>rows.push((row.values as unknown[]).slice(1).map(value=>String(value??'').trim())));await requestPreview({headers:rows[0]??[],rows:rows.slice(1)})}catch(reason){setError(reason instanceof Error?reason.message:'Excel 读取失败')}finally{setBusy(false)}};
  const apply=async()=>{if(!grid)return;setBusy(true);setError('');try{const result=await onImport(classId,grid);onComplete(result)}catch(reason){setError(reason instanceof Error?reason.message:'导入失败')}finally{setBusy(false)}};
  const totals=preview?.rows.reduce((acc,row)=>({...acc,[row.action]:acc[row.action]+1}),{create:0,update:0,conflict:0,invalid:0})??{create:0,update:0,conflict:0,invalid:0};

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-label="智能导入学生资料" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900"><div className="flex items-start justify-between border-b p-5"><div><h3 className="font-bold">智能导入学生资料</h3><p className="mt-1 text-xs text-slate-400">自动识别列名，已有学生更新资料，新学生加入名册；冲突行不会覆盖。</p></div><button onClick={onClose} aria-label="关闭"><X className="h-5 w-5"/></button></div><div className="flex-1 space-y-4 overflow-y-auto p-5">
    <label className="space-y-1"><span className="text-xs font-bold text-slate-500">目标班级</span><select value={classId} onChange={e=>{setClassId(e.target.value);setPreview(null)}} className="block w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm">{classes.filter(item=>item.status==='active').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="grid gap-3 md:grid-cols-[1fr_180px]"><textarea value={text} onChange={e=>setText(e.target.value)} rows={7} placeholder={'学生姓名\t家长手机号码\n张三\t13800000000'} className="rounded-2xl border bg-slate-50 p-3 font-mono text-sm"/><div className="flex flex-col gap-2"><button disabled={busy} onClick={()=>void requestPreview(parseText(text))} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white"><FileSpreadsheet className="h-4 w-4"/>解析粘贴内容</button><label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2.5 text-xs font-bold text-emerald-700"><Upload className="h-4 w-4"/>上传 Excel<input type="file" accept=".xlsx" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void readExcel(file)}}/></label><p className="text-[11px] leading-5 text-slate-400">支持从 Excel 直接复制粘贴，或上传 .xlsx 文件。首行应为列名。</p></div></div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
    {grid&&preview&&<><section className="rounded-2xl border p-4"><h4 className="mb-3 text-xs font-black">列字段匹配</h4><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{grid.headers.map((header,index)=><label key={`${header}-${index}`} className="grid grid-cols-[1fr_130px] items-center gap-2 rounded-xl bg-slate-50 p-2 text-xs"><span className="truncate font-semibold">{header||`第 ${index+1} 列`}</span><select value={grid.mapping?.[index]??''} onChange={e=>void updateMapping(index,e.target.value)} className="rounded-lg border bg-white px-2 py-1.5"><option value="">忽略</option>{fields.map(field=><option key={field.value} value={field.value}>{field.label}</option>)}</select></label>)}</div></section><div className="flex flex-wrap gap-2 text-xs"><Badge tone="emerald">新增 {totals.create}</Badge><Badge tone="blue">更新 {totals.update}</Badge><Badge tone="amber">冲突 {totals.conflict}</Badge><Badge tone="red">不可处理 {totals.invalid}</Badge></div><div className="overflow-x-auto rounded-2xl border"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="px-3 py-2">行</th><th className="px-3 py-2">姓名</th><th className="px-3 py-2">学号</th><th className="px-3 py-2">处理方式</th><th className="px-3 py-2">说明</th></tr></thead><tbody className="divide-y">{preview.rows.map(row=><tr key={row.row}><td className="px-3 py-2">{row.row}</td><td className="px-3 py-2 font-semibold">{row.name||'—'}</td><td className="px-3 py-2 font-mono">{row.studentNo||'—'}</td><td className="px-3 py-2">{{create:'新增学生',update:'更新档案',conflict:'需要确认',invalid:'无法处理'}[row.action]}</td><td className="px-3 py-2 text-slate-500">{row.message??(row.changes.length?`更新：${row.changes.map(key=>fields.find(field=>field.value===key)?.label??key).join('、')}`:'核对基础信息')}</td></tr>)}</tbody></table></div></>}
  </div><div className="flex items-center justify-between border-t p-4"><span className="text-xs text-slate-400">冲突和不可处理行会保留，不会写入数据库。</span><div className="flex gap-2"><button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-xs">取消</button><button disabled={!grid||!preview||busy||totals.create+totals.update===0} onClick={()=>void apply()} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?'处理中…':`确认新增/更新 ${totals.create+totals.update} 条`}</button></div></div></div></div>;
}

function Badge({tone,children}:{tone:'emerald'|'blue'|'amber'|'red';children:React.ReactNode}){const styles={emerald:'bg-emerald-100 text-emerald-800',blue:'bg-blue-100 text-blue-800',amber:'bg-amber-100 text-amber-800',red:'bg-red-100 text-red-800'};return <span className={`rounded-full px-2.5 py-1 font-bold ${styles[tone]}`}>{children}</span>}
