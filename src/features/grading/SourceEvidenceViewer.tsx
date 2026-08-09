/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileSearch, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';
import { SourceEvidence } from '../../domain/types';

interface SourceEvidenceViewerProps {
  evidence: SourceEvidence;
  label: string;
}

function EvidencePage({ evidence, expanded = false }: { evidence: SourceEvidence; expanded?: boolean }) {
  if (evidence.imageUrl) {
    return <img src={evidence.imageUrl} alt={`${evidence.fileName} 第 ${evidence.pageNumber} 页来源区域`} className="h-full w-full object-contain" />;
  }

  return (
    <div className={`h-full w-full bg-[#fffdf7] text-left text-slate-700 ${expanded ? 'p-10' : 'p-4'}`}>
      <div className="flex justify-between border-b border-slate-300 pb-2 font-mono text-[10px] text-slate-400"><span>第 {evidence.pageNumber} 页</span><span>{evidence.isMock ? '模拟上传原图' : '原始材料'}</span></div>
      <p className={`font-serif leading-8 ${expanded ? 'mt-10 text-xl' : 'mt-4 text-xs'}`}>{evidence.ocrText}</p>
    </div>
  );
}

export default function SourceEvidenceViewer({ evidence, label }: SourceEvidenceViewerProps) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const close = () => {
    setOpen(false);
    setZoom(1);
    setRotation(0);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group w-full overflow-hidden border border-slate-200 bg-white text-left transition-colors hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="aspect-[4/3] overflow-hidden"><EvidencePage evidence={evidence} /></div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 dark:border-zinc-700"><span className="truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">{label} · 第 {evidence.pageNumber} 页</span><ZoomIn className="h-3.5 w-3.5 flex-none text-emerald-700" /></div>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${label}来源原图`}>
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-t-lg bg-white px-4 py-3 dark:bg-zinc-900"><div className="min-w-0"><h2 className="truncate text-sm font-black text-slate-900 dark:text-white">{evidence.fileName}</h2><p className="mt-1 text-xs text-slate-500">第 {evidence.pageNumber} 页 · OCR {Math.round(evidence.confidence * 100)}%{evidence.isMock ? ' · 模拟来源' : ''}</p></div><div className="flex items-center gap-1"><button type="button" title="缩小" aria-label="缩小" onClick={() => setZoom(value => Math.max(0.6, value - 0.2))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"><ZoomOut className="h-4 w-4" /></button><button type="button" title="放大" aria-label="放大" onClick={() => setZoom(value => Math.min(3, value + 0.2))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"><ZoomIn className="h-4 w-4" /></button><button type="button" title="旋转" aria-label="旋转" onClick={() => setRotation(value => value + 90)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"><RotateCw className="h-4 w-4" /></button><button type="button" title="关闭" aria-label="关闭" onClick={close} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button></div></header>
          <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center overflow-auto rounded-b-lg bg-slate-200 p-8 dark:bg-zinc-950"><div className="aspect-[3/4] w-[min(680px,75vw)] flex-none overflow-hidden bg-white shadow-2xl transition-transform" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}><EvidencePage evidence={evidence} expanded /></div></div>
          <span className="pointer-events-none absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-slate-950/75 px-3 py-1.5 text-xs text-white"><FileSearch className="h-3.5 w-3.5" />来源区域 {Math.round(evidence.boundingBox.x * 100)}%, {Math.round(evidence.boundingBox.y * 100)}%</span>
        </div>
      ) : null}
    </>
  );
}
