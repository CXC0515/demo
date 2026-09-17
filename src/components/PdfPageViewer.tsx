import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, Maximize2, Minus, Plus } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let pdfModulePromise: Promise<typeof import('pdfjs-dist')> | undefined;
const loadPdfModule = async () => {
  pdfModulePromise ??= import('pdfjs-dist').then(module => {
    module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    return module;
  });
  return pdfModulePromise;
};

export default function PdfPageViewer({ source, page, onPageChange, navigation = true, openUrl, className = '' }: {
  source: string | File;
  page: number;
  onPageChange?: (page: number) => void;
  navigation?: boolean;
  openUrl?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    const update = () => setContainerWidth(target.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let nextDocument: PDFDocumentProxy | null = null;
    setLoading(true);
    setError('');
    setDocument(null);
    void (async () => {
      try {
        const pdfjs = await loadPdfModule();
        const input = source instanceof File
          ? { data: new Uint8Array(await source.arrayBuffer()) }
          : { url: source, withCredentials: true };
        nextDocument = await pdfjs.getDocument(input).promise;
        if (!active) {
          await nextDocument.destroy();
          return;
        }
        setDocument(nextDocument);
        setPageCount(nextDocument.numPages);
        if (page > nextDocument.numPages) onPageChange?.(nextDocument.numPages);
      } catch {
        if (active) setError('PDF 无法渲染，文件可能已损坏、加密或暂时无法读取。');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (nextDocument) void nextDocument.destroy();
    };
  }, [source]);

  useEffect(() => {
    if (!document || !canvasRef.current || !containerWidth) return;
    let active = true;
    let pdfPage: PDFPageProxy | null = null;
    let renderTask: RenderTask | null = null;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        pdfPage = await document.getPage(Math.max(1, Math.min(page, document.numPages)));
        if (!active || !canvasRef.current || !containerRef.current) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const fitScale = Math.max(0.25, (containerRef.current.clientWidth - 24) / baseViewport.width);
        const viewport = pdfPage.getViewport({ scale: fitScale * zoom });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
        renderTask = pdfPage.render({ canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
        await renderTask.promise;
      } catch (cause) {
        if (active && !(cause instanceof Error && cause.name === 'RenderingCancelledException')) setError('这一页暂时无法显示，请重试或打开原文件。');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      renderTask?.cancel();
      pdfPage?.cleanup();
    };
  }, [containerWidth, document, page, zoom]);

  const goTo = (nextPage: number) => onPageChange?.(Math.max(1, Math.min(pageCount || 1, nextPage)));
  return <div className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}>
    <div className="flex min-h-11 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900">
      {navigation ? <>
        <button type="button" disabled={page <= 1} onClick={() => goTo(page - 1)} className="grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30" aria-label="上一页"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-16 text-center text-xs font-bold text-slate-600 dark:text-slate-300">{page} / {pageCount || '—'}</span>
        <button type="button" disabled={!pageCount || page >= pageCount} onClick={() => goTo(page + 1)} className="grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30" aria-label="下一页"><ChevronRight className="h-4 w-4" /></button>
      </> : <span className="text-xs font-bold text-slate-500">首页预览</span>}
      <div className="ml-auto flex items-center gap-1">
        <button type="button" disabled={zoom <= 0.75} onClick={() => setZoom(value => Math.max(0.75, Number((value - 0.25).toFixed(2))))} className="grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30" aria-label="缩小"><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={() => setZoom(1)} className="grid h-9 w-9 place-items-center rounded-lg" aria-label="适应宽度"><Maximize2 className="h-4 w-4" /></button>
        <button type="button" disabled={zoom >= 2.5} onClick={() => setZoom(value => Math.min(2.5, Number((value + 0.25).toFixed(2))))} className="grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30" aria-label="放大"><Plus className="h-4 w-4" /></button>
        {openUrl ? <a href={openUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg" aria-label="打开原文件"><ExternalLink className="h-4 w-4" /></a> : null}
      </div>
    </div>
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto p-3">
      {loading ? <div className="absolute inset-0 z-10 grid place-items-center bg-slate-100/80 text-slate-500 dark:bg-zinc-950/80"><span className="flex items-center gap-2 text-sm font-bold"><LoaderCircle className="h-5 w-5 animate-spin" />正在渲染 PDF</span></div> : null}
      {error ? <div className="grid min-h-48 place-items-center px-6 text-center"><div><p className="text-sm font-bold text-rose-700">{error}</p>{openUrl ? <a href={openUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-emerald-300 px-4 text-sm font-bold text-emerald-700">打开原文件</a> : null}</div></div> : <canvas ref={canvasRef} className="mx-auto block bg-white shadow-sm" />}
    </div>
  </div>;
}
