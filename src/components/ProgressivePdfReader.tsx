import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export default function ProgressivePdfReader({ pageCount, selectedPage, pageBaseUrl, openUrl, onPageChange, className = '' }: {
  pageCount: number;
  selectedPage: number;
  pageBaseUrl: string;
  openUrl?: string;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const ratios = useRef(new Map<number, number>());
  const pageCache = useRef(new Map<number, Promise<ArrayBuffer>>());
  const cacheOrder = useRef<number[]>([]);
  const activePageRef = useRef(Math.max(1, selectedPage));
  const [activePage, setActivePage] = useState(Math.max(1, selectedPage));
  const [zoom, setZoom] = useState(1);
  const [readyPages, setReadyPages] = useState<Set<number>>(() => new Set());
  const safePageCount = Math.max(1, pageCount);
  const renderedPages = useMemo(() => {
    const pages = new Set<number>();
    if (activePage > 1 && readyPages.has(activePage - 1)) pages.add(activePage - 1);
    let waitingForPage = false;
    for (let page = activePage; page <= Math.min(safePageCount, activePage + 3); page += 1) {
      if (readyPages.has(page)) pages.add(page);
      else if (!waitingForPage) {
        pages.add(page);
        waitingForPage = true;
      }
    }
    return pages;
  }, [activePage, readyPages, safePageCount]);

  const loadPage = useCallback((page: number) => {
    const cached = pageCache.current.get(page);
    if (cached) return cached;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    const request = fetch(`${pageBaseUrl}/pages/${page}/content`, { credentials: 'include', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`PAGE_${response.status}`);
      return response.arrayBuffer();
    }).finally(() => window.clearTimeout(timeout)).catch(error => {
      pageCache.current.delete(page);
      throw error;
    });
    pageCache.current.set(page, request);
    cacheOrder.current = [...cacheOrder.current.filter(value => value !== page), page];
    while (cacheOrder.current.length > 7) {
      const expiredIndex = cacheOrder.current.findIndex(value => Math.abs(value - activePageRef.current) > 3);
      if (expiredIndex < 0) break;
      const [expired] = cacheOrder.current.splice(expiredIndex, 1);
      pageCache.current.delete(expired);
      setReadyPages(current => {
        if (!current.has(expired)) return current;
        const next = new Set(current);
        next.delete(expired);
        return next;
      });
    }
    return request;
  }, [pageBaseUrl]);

  useEffect(() => { activePageRef.current = activePage; }, [activePage]);

  useEffect(() => {
    pageCache.current.clear();
    cacheOrder.current = [];
    setReadyPages(new Set());
  }, [pageBaseUrl]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => ratios.current.set(Number((entry.target as HTMLElement).dataset.page), entry.intersectionRatio));
      const visible = [...ratios.current.entries()].sort((left, right) => right[1] - left[1])[0];
      if (!visible || visible[1] <= 0 || visible[0] === activePage) return;
      setActivePage(visible[0]);
      onPageChange(visible[0]);
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    pageRefs.current.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [activePage, onPageChange, safePageCount]);

  useEffect(() => {
    const targetPage = Math.max(1, Math.min(safePageCount, selectedPage));
    if (targetPage === activePage) return;
    setActivePage(targetPage);
    pageRefs.current.get(targetPage)?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [activePage, safePageCount, selectedPage]);

  const goTo = (page: number) => {
    const targetPage = Math.max(1, Math.min(safePageCount, page));
    setActivePage(targetPage);
    onPageChange(targetPage);
    pageRefs.current.get(targetPage)?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  const markReady = useCallback((page: number) => setReadyPages(current => current.has(page) ? current : new Set(current).add(page)), []);

  return <div className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}>
    <div className="flex min-h-11 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900">
      <button type="button" disabled={activePage <= 1} onClick={() => goTo(activePage - 1)} className="grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30" aria-label="上一页"><ChevronLeft className="h-4 w-4" /></button>
      <span className="min-w-20 text-center text-xs font-bold text-slate-600 dark:text-slate-300">{activePage} / {pageCount || '—'}</span>
      <button type="button" disabled={activePage >= safePageCount} onClick={() => goTo(activePage + 1)} className="grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30" aria-label="下一页"><ChevronRight className="h-4 w-4" /></button>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" disabled={zoom <= 0.75} onClick={() => setZoom(value => Math.max(0.75, Number((value - 0.25).toFixed(2))))} className="grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30" aria-label="缩小"><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={() => setZoom(1)} className="grid h-9 w-9 place-items-center rounded-lg" aria-label="适应宽度"><Maximize2 className="h-4 w-4" /></button>
        <button type="button" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, Number((value + 0.25).toFixed(2))))} className="grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30" aria-label="放大"><Plus className="h-4 w-4" /></button>
        {openUrl ? <a href={openUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg" aria-label="打开原文件"><ExternalLink className="h-4 w-4" /></a> : null}
      </div>
    </div>
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-contain px-2 py-3 sm:px-4">
      <div className="mx-auto grid max-w-5xl gap-4">
        {Array.from({ length: safePageCount }, (_, index) => index + 1).map(page => <section key={page} ref={element => { if (element) pageRefs.current.set(page, element); else pageRefs.current.delete(page); }} data-page={page} aria-label={`PDF 第 ${page} 页`} className="scroll-mt-3">
          <div className="mb-1 text-center text-xs font-bold text-slate-400">第 {page} 页</div>
          {renderedPages.has(page)
            ? <ProgressivePdfPage page={page} zoom={zoom} loadPage={loadPage} onReady={markReady} />
            : <div className="mx-auto aspect-[210/297] w-full max-w-[900px] rounded-md border border-dashed border-slate-300 bg-white/50 dark:border-zinc-700 dark:bg-zinc-900/40" />}
        </section>)}
      </div>
    </div>
  </div>;
}

function ProgressivePdfPage({ page, zoom, loadPage, onReady }: { page: number; zoom: number; loadPage: (page: number) => Promise<ArrayBuffer>; onReady: (page: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    const update = () => setWidth(target.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !canvasRef.current) return;
    let active = true;
    let document: PDFDocumentProxy | null = null;
    let pdfPage: PDFPageProxy | null = null;
    let renderTask: RenderTask | null = null;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const [pdfjs, data] = await Promise.all([loadPdfModule(), loadPage(page)]);
        document = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
        pdfPage = await document.getPage(1);
        if (!active || !canvasRef.current || !containerRef.current) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const fitScale = Math.max(0.25, (containerRef.current.clientWidth - 2) / baseViewport.width);
        const viewport = pdfPage.getViewport({ scale: fitScale * zoom });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        setCanvasHeight(Math.floor(viewport.height));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
        renderTask = pdfPage.render({ canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
        await renderTask.promise;
        if (active) onReady(page);
      } catch (cause) {
        if (active && !(cause instanceof Error && cause.name === 'RenderingCancelledException')) setError('这一页加载失败，可稍后重试或打开原文件。');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      renderTask?.cancel();
      pdfPage?.cleanup();
      if (document) void document.destroy();
    };
  }, [loadPage, onReady, page, width, zoom]);

  return <div ref={containerRef} style={canvasHeight ? { minHeight: canvasHeight } : undefined} className={`relative mx-auto w-full max-w-[900px] overflow-x-auto rounded-md bg-white shadow-sm ${canvasHeight ? '' : 'aspect-[210/297]'}`}>
    {loading ? <div className="absolute inset-0 z-10 grid place-items-center bg-white/85 text-slate-500"><span className="flex items-center gap-2 text-sm font-bold"><LoaderCircle className="h-5 w-5 animate-spin" />正在加载第 {page} 页</span></div> : null}
    {error ? <div className="absolute inset-0 z-10 grid place-items-center bg-white px-6 text-center text-sm font-bold text-rose-700">{error}</div> : null}
    <canvas ref={canvasRef} className="mx-auto block bg-white" />
  </div>;
}
