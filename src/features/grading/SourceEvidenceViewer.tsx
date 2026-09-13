/** @license SPDX-License-Identifier: Apache-2.0 */
import { RotateCw, ScanLine, X, ZoomIn, ZoomOut } from 'lucide-react';
import { PointerEvent as ReactPointerEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { SourceEvidence } from '../../domain/types';
import { EvidenceRegionComparison } from '../../services/gradingApi';

type Box = SourceEvidence['boundingBox'];

interface SourceEvidenceViewerProps {
  evidence: SourceEvidence;
  label: string;
  onCompareRegion?: (boundingBox: Box, runOcr: boolean) => Promise<EvidenceRegionComparison>;
  onSaveRegion?: (boundingBox: Box) => Promise<void>;
}

function EvidencePage({ evidence, expanded = false, fullPage = false }: { evidence: SourceEvidence; expanded?: boolean; fullPage?: boolean }) {
  const imageUrl = fullPage ? evidence.sourcePageUrl : evidence.imageUrl;
  if (imageUrl) return <img draggable={false} src={imageUrl} alt={`${evidence.fileName} 第 ${evidence.pageNumber} 页${fullPage ? '完整原页' : '来源区域'}`} className={expanded ? 'block max-h-[65dvh] max-w-full select-none object-contain' : 'h-full w-full object-contain'} />;
  return <div className={`h-full w-full bg-[#fffdf7] text-left text-slate-700 ${expanded ? 'p-8' : 'p-4'}`}><div className="flex justify-between border-b border-slate-300 pb-2 font-mono text-[10px] text-slate-400"><span>第 {evidence.pageNumber} 页</span><span>{evidence.isMock ? '模拟上传原图' : '原生文本'}</span></div><p className={`font-serif leading-8 ${expanded ? 'mt-8 text-xl' : 'mt-4 text-xs'}`}>{evidence.ocrText}</p></div>;
}

const statusText = (result: EvidenceRegionComparison) => result.geometricStatus === 'covered' ? '框内已有 OCR 文本覆盖原引用' : result.geometricStatus === 'empty' ? '框内没有现成 OCR 文本' : '框内 OCR 文本与原引用不完全一致';

export default function SourceEvidenceViewer({ evidence, label, onCompareRegion, onSaveRegion }: SourceEvidenceViewerProps) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Box>(evidence.boundingBox);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [comparison, setComparison] = useState<EvidenceRegionComparison | null>(null);
  const [busy, setBusy] = useState<'compare' | 'ocr' | 'save' | null>(null);

  const close = () => { setOpen(false); setZoom(1); setRotation(0); setSelecting(false); setComparison(null); };
  const pointIn = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) };
  };
  const beginSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!selecting) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointIn(event);
    setDragStart(point);
    setSelection({ ...point, width: 0.001, height: 0.001 });
    setComparison(null);
  };
  const moveSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const point = pointIn(event);
    setSelection({ x: Math.min(dragStart.x, point.x), y: Math.min(dragStart.y, point.y), width: Math.max(0.001, Math.abs(point.x - dragStart.x)), height: Math.max(0.001, Math.abs(point.y - dragStart.y)) });
  };
  const runComparison = async (runOcr: boolean) => {
    if (!onCompareRegion) return;
    setBusy(runOcr ? 'ocr' : 'compare');
    try { setComparison(await onCompareRegion(selection, runOcr)); } finally { setBusy(null); }
  };
  const saveSelection = async () => {
    if (!onSaveRegion) return;
    setBusy('save');
    try { await onSaveRegion(selection); close(); } finally { setBusy(null); }
  };

  const modal = open ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={`${label}来源原图`}><div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] dark:bg-zinc-900"><header className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-800"><div className="min-w-0"><h2 className="truncate text-sm font-black text-slate-900 dark:text-white">{evidence.fileName}</h2><p className="mt-1 text-xs text-slate-500">第 {evidence.pageNumber} 页 · OCR {Math.round(evidence.confidence * 100)}%</p></div><div className="flex items-center gap-1">{evidence.sourcePageUrl && onSaveRegion ? <button type="button" onClick={() => { setSelecting(value => !value); setSelection(evidence.boundingBox); setComparison(null); setZoom(1); setRotation(0); }} className={`min-h-10 rounded-xl px-3 text-xs font-bold ${selecting ? 'bg-emerald-700 text-white' : 'border border-slate-200 text-slate-700 dark:border-zinc-700 dark:text-slate-200'}`}><ScanLine className="mr-1 inline h-4 w-4" />{selecting ? '正在框选' : '手动框选'}</button> : null}{!selecting ? <><button type="button" title="缩小" aria-label="缩小" onClick={() => setZoom(value => Math.max(0.6, value - 0.2))} className="rounded-lg p-2 text-slate-500"><ZoomOut className="h-4 w-4" /></button><button type="button" title="放大" aria-label="放大" onClick={() => setZoom(value => Math.min(3, value + 0.2))} className="rounded-lg p-2 text-slate-500"><ZoomIn className="h-4 w-4" /></button><button type="button" title="旋转" aria-label="旋转" onClick={() => setRotation(value => value + 90)} className="rounded-lg p-2 text-slate-500"><RotateCw className="h-4 w-4" /></button></> : null}<button type="button" title="关闭" aria-label="关闭" onClick={close} className="rounded-lg p-2 text-slate-500"><X className="h-4 w-4" /></button></div></header><div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-3 dark:bg-zinc-950"><div className="flex min-h-full items-center justify-center"><div className="relative inline-block origin-center touch-none transition-transform" style={!selecting ? { transform: `scale(${zoom}) rotate(${rotation}deg)` } : undefined} onPointerDown={beginSelection} onPointerMove={moveSelection} onPointerUp={() => setDragStart(null)} onPointerCancel={() => setDragStart(null)}><EvidencePage evidence={evidence} expanded fullPage={selecting} />{selecting ? <div className="pointer-events-none absolute border-2 border-emerald-500 bg-emerald-400/15 shadow-[0_0_0_9999px_rgba(15,23,42,0.42)]" style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }} /> : null}</div></div></div>{selecting ? <footer className="flex-none border-t border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-xs text-slate-500">在完整原页上拖动框选大题区域。保存后该人工范围优先于 AI 坐标。</p>{comparison ? <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 dark:bg-zinc-950"><strong className={comparison.geometricStatus === 'covered' ? 'text-emerald-700' : 'text-amber-700'}>{statusText(comparison)}</strong>{comparison.intersectingText ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-slate-600 dark:text-slate-300">框内现有 OCR：{comparison.intersectingText}</p> : null}{comparison.ocrStatus === 'completed' ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-slate-600 dark:text-slate-300">重新 OCR：{comparison.focusedOcrText || '未识别到文字'}</p> : comparison.ocrStatus === 'failed' ? <p className="mt-1 text-amber-700">重新 OCR 暂时失败；框选结果仍可保存。</p> : null}</div> : null}<div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void runComparison(false)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold dark:border-zinc-700">{busy === 'compare' ? '比对中...' : '比对现有 OCR'}</button><button type="button" disabled={Boolean(busy)} onClick={() => void runComparison(true)} className="min-h-11 rounded-xl border border-emerald-700 px-4 text-xs font-bold text-emerald-700">{busy === 'ocr' ? 'OCR 校验中...' : '重新 OCR 校验'}</button><button type="button" disabled={Boolean(busy) || selection.width < 0.01 || selection.height < 0.01} onClick={() => void saveSelection()} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-zinc-800">{busy === 'save' ? '保存中...' : '保存框选范围'}</button></div></footer> : evidence.ocrText ? <footer className="flex-none border-t border-slate-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"><strong className="text-xs text-emerald-700">本题引用原文</strong><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{evidence.ocrText}</p></footer> : null}</div></div> : null;

  return <><button type="button" onClick={() => setOpen(true)} className="group w-full overflow-hidden border border-slate-200 bg-white text-left transition-colors hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"><div className="aspect-[4/3] overflow-hidden"><EvidencePage evidence={evidence} /></div><div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 dark:border-zinc-700"><span className="truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">{label} · 第 {evidence.pageNumber} 页</span><ZoomIn className="h-3.5 w-3.5 flex-none text-emerald-700" /></div>{evidence.imageUrl && evidence.ocrText ? <p className="line-clamp-3 border-t border-slate-200 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:border-zinc-700">本题引用：{evidence.ocrText}</p> : null}{evidence.cropMode === 'teacher-manual' ? <p className="border-t border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">教师已手动确认截图范围。</p> : evidence.cropMode === 'model-within-block' ? <p className="border-t border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-800">AI 在 OCR 块内定位的大题区域，可手动调整。</p> : evidence.isPartialBlock ? <p className="border-t border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-800">原 OCR 块可能包含多题；准确引用见上方文字。</p> : null}{evidence.locatorStatus && evidence.locatorStatus !== 'located' ? <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{evidence.locatorReasons?.join('；') || '来源区域需要核验'}</p> : null}</button>{modal ? createPortal(modal, document.body) : null}</>;
}
