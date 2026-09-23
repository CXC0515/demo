import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, FileText, Folder, FolderPlus, Image, RotateCcw, Search, SkipForward, Trash2, Upload } from 'lucide-react';
import type { PoolFolder, PoolItem } from '../../domain/materialPool';
import { createPoolFolder, listPoolFolders, listPoolItems, renamePoolFolder, restorePoolItem, trashPoolItem, updatePoolItem, uploadPoolItem } from '../../services/materialPoolApi';

interface Props {
  presetKey?: string;
  onOpenResource: (resourceId: string) => void;
  onShowToast: (message: string) => void;
}

const acceptedFiles = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.pptx,.xlsx,.txt';
const formatSize = (bytes: number) => bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '大小未记录';
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后重试';

export default function MaterialPool({ presetKey, onOpenResource, onShowToast }: Props) {
  const [folders, setFolders] = useState<PoolFolder[]>([]);
  const [items, setItems] = useState<PoolItem[]>([]);
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'saved' | 'trashed'>('saved');
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [quickMode, setQuickMode] = useState(false);
  const [quickIndex, setQuickIndex] = useState(0);
  const [quickTargets, setQuickTargets] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ id: string; folderId: string | null; index: number } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const loadRequest = useRef(0);

  const refresh = useCallback(async (currentFolder = folderId, currentQuery = query, currentState = state) => {
    const requestId = ++loadRequest.current;
    setLoading(true);
    try {
      const [nextFolders, result] = await Promise.all([
        listPoolFolders(), listPoolItems({ folderId: currentFolder, q: currentQuery.trim(), state: currentState }),
      ]);
      if (requestId !== loadRequest.current) return;
      setFolders(nextFolders);
      setItems(result.items);
      setNextOffset(result.nextOffset);
      setQuickTargets(current => current.filter(id => nextFolders.some(folder => folder.id === id)).slice(0, 2));
    } catch (error) { if (requestId === loadRequest.current) onShowToast(`材料池加载失败：${errorText(error)}`); }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }, [folderId, query, state, onShowToast]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!presetKey || !folders.length) return;
    const target = folders.find(folder => folder.presetKey === presetKey);
    if (target) setFolderId(target.id);
  }, [presetKey, folders]);

  const currentFolder = folderId ? folders.find(folder => folder.id === folderId) : null;
  const visibleFolders = folders.filter(folder => folder.parentId === (folderId ?? null));
  const breadcrumb = useMemo(() => {
    const result: PoolFolder[] = [];
    let next = currentFolder;
    while (next) { result.unshift(next); next = next.parentId ? folders.find(folder => folder.id === next!.parentId) : undefined; }
    return result;
  }, [currentFolder, folders]);
  const quickItems = items.filter(item => !item.folderId && item.state === 'saved');
  const quickItem = quickItems[quickIndex] ?? null;
  const activeItem = items.find(item => item.id === activeItemId) ?? null;

  const openFolder = (id: string | null | undefined) => {
    setFolderId(id); setQuickMode(false); setActiveItemId(null); setSelectedIds([]);
  };
  const saveMove = async (id: string, target: string | null, quick = false) => {
    const original = items.find(item => item.id === id);
    if (!original) return;
    try {
      const next = await updatePoolItem(id, { folderId: target });
      setItems(current => current.map(item => item.id === id ? next : item));
      if (quick) setLastMove({ id, folderId: original.folderId, index: quickIndex });
      if (!quick && folderId !== undefined && original.folderId !== target) { setActiveItemId(null); await refresh(); }
      if (target) setQuickTargets(current => [target, ...current.filter(folder => folder !== target), ...folders.filter(folder => folder.id !== target).map(folder => folder.id)].filter((value, index, all) => all.indexOf(value) === index).slice(0, 2));
      onShowToast(target ? `已放入 ${folders.find(folder => folder.id === target)?.name ?? '文件夹'}，可撤销` : '已移到未整理');
    } catch (error) { onShowToast(errorText(error)); }
  };
  const undoMove = async () => {
    if (!lastMove) return;
    const move = lastMove;
    try {
      const restored = await updatePoolItem(move.id, { folderId: move.folderId });
      setItems(current => current.map(item => item.id === move.id ? restored : item));
      setQuickIndex(move.index);
      setLastMove(null);
      onShowToast('已撤销上一步归类');
    } catch (error) { onShowToast(errorText(error)); }
  };
  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let saved = 0;
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try { await uploadPoolItem(file); saved += 1; }
      catch (error) { errors.push(`${file.name}：${errorText(error)}`); if (errorText(error).includes('上传次数已达上限')) break; }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = '';
    await refresh();
    onShowToast(`已保存 ${saved} 份材料${errors.length ? `；${errors.length} 份失败：${errors.slice(0, 2).join('；')}` : ''}`);
  };
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createPoolFolder(newFolderName.trim(), folderId ?? null);
      setNewFolderName(''); await refresh();
    } catch (error) { onShowToast(errorText(error)); }
  };
  const applyTags = async () => {
    if (!activeItem) return;
    const tags = tagDraft.split(/[，,]/).map(tag => tag.trim()).filter(Boolean);
    try {
      const next = await updatePoolItem(activeItem.id, { tags });
      setItems(current => current.map(item => item.id === next.id ? next : item));
      onShowToast('标签已保存');
    } catch (error) { onShowToast(errorText(error)); }
  };
  const batchMove = async (target: string | null) => {
    let moved = 0;
    for (const id of selectedIds) {
      try { await updatePoolItem(id, { folderId: target }); moved += 1; }
      catch (error) { onShowToast(`${moved} 份已移动，其余未改动：${errorText(error)}`); break; }
    }
    setSelectedIds([]); await refresh();
    if (moved) onShowToast(`已移动 ${moved} 份材料`);
  };

  const itemPreview = (item: PoolItem) => item.detectedMime === 'application/pdf'
    ? <iframe title={`${item.originalName} 预览`} src={item.contentUrl} className="h-full w-full rounded-xl border border-slate-200 dark:border-zinc-700" />
    : item.detectedMime.startsWith('image/')
      ? <img src={item.contentUrl} alt={item.originalName} className="max-h-full max-w-full rounded-xl object-contain" />
      : <div className="grid h-full place-items-center rounded-xl bg-slate-50 text-center text-sm text-slate-500 dark:bg-zinc-900"><div><FileText className="mx-auto mb-3 h-10 w-10" />此格式暂不支持在线预览<br />可以下载原件</div></div>;

  return <div className="flex h-full min-h-0 flex-col gap-3 animate-fade-in" id="material-pool-page">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold text-emerald-700">资料库</p><h2 className="text-xl font-black sm:text-2xl">材料池</h2><p className="text-sm text-slate-500">先保存与整理原件，需要时再选入资料编辑。</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setState('saved'); setQuery(''); openFolder(null); setQuickIndex(0); setQuickMode(true); }} className="btn-secondary min-h-11 px-3 text-sm">快速整理</button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="btn-primary flex min-h-11 items-center gap-2 px-3 text-sm"><Upload className="h-4 w-4" />{uploading ? '正在上传' : '上传文件'}</button>
        <input ref={fileInput} type="file" multiple accept={acceptedFiles} className="sr-only" onChange={event => void uploadFiles(event.target.files)} />
      </div>
    </header>
    {quickMode ? <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="font-bold">整理未归类材料</h3><p className="text-xs text-slate-500">点下方文件夹归类；左滑跳过，右滑撤销。</p></div><button className="btn-secondary min-h-11 px-3 text-sm" onClick={() => setQuickMode(false)}>返回列表</button></div>
      {quickItem ? <div className="flex min-h-0 flex-1 flex-col gap-3" onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={event => {
        if (!touchStart.current) return;
        const dx = event.changedTouches[0].clientX - touchStart.current.x;
        const dy = event.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) setQuickIndex(current => current + 1);
        else void undoMove();
      }}>
        <div className="h-[min(28dvh,220px)] shrink-0 overflow-hidden sm:h-auto sm:min-h-0 sm:flex-1">{itemPreview(quickItem)}</div>
        <div><p className="truncate font-bold">{quickItem.originalName}</p><p className="text-xs text-slate-500">{formatSize(quickItem.sizeBytes)} · 第 {quickIndex + 1} 份</p></div>
        <div className="flex gap-2"><button className="btn-secondary flex min-h-11 flex-1 items-center justify-center gap-1 text-sm" onClick={() => setQuickIndex(current => current + 1)}><SkipForward className="h-4 w-4" />跳过</button><button className="btn-secondary flex min-h-11 flex-1 items-center justify-center gap-1 text-sm" onClick={() => void undoMove()} disabled={!lastMove}><RotateCcw className="h-4 w-4" />撤销</button></div>
        <div className="grid grid-cols-2 gap-2">{(quickTargets.length ? quickTargets : folders.filter(folder => !folder.parentId).slice(0, 2).map(folder => folder.id)).map(id => {
          const folder = folders.find(candidate => candidate.id === id); return folder ? <button key={id} className="btn-primary min-h-12 truncate px-2 text-sm" onClick={() => void saveMove(quickItem.id, id, true)}>{folder.name}</button> : null;
        })}</div>
        <label className="text-xs text-slate-500">更换快捷文件夹
          <select className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:bg-zinc-900" value="" onChange={event => { const id = event.target.value; if (id) setQuickTargets(current => [id, ...current.filter(entry => entry !== id)].slice(0, 2)); }}><option value="">选择文件夹</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
        </label>
      </div> : <div className="grid flex-1 place-items-center text-center text-sm text-slate-500">这轮已看完。跳过的材料仍留在「未整理」。<button className="btn-secondary mt-3 min-h-11 px-4" onClick={() => setQuickIndex(0)}>再看一遍</button></div>}
    </div> : <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="glass-panel hidden min-h-0 overflow-y-auto rounded-2xl p-3 lg:block">
        <div className="space-y-1"><button className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm ${folderId === undefined && state === 'saved' ? 'bg-emerald-100 font-bold text-emerald-900' : ''}`} onClick={() => { setState('saved'); openFolder(undefined); }}>全部材料</button><button className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm ${folderId === null && state === 'saved' ? 'bg-emerald-100 font-bold text-emerald-900' : ''}`} onClick={() => { setState('saved'); openFolder(null); }}>未整理</button>{folders.filter(folder => !folder.parentId).map(folder => <button key={folder.id} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm ${folderId === folder.id ? 'bg-emerald-100 font-bold text-emerald-900' : ''}`} onClick={() => { setState('saved'); openFolder(folder.id); }}><Folder className="h-4 w-4" />{folder.name}</button>)}<button className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm ${state === 'trashed' ? 'bg-emerald-100 font-bold text-emerald-900' : ''}`} onClick={() => { setState('trashed'); openFolder(undefined); }}><Trash2 className="h-4 w-4" />回收站</button></div>
        <form className="mt-4 flex gap-2" onSubmit={event => { event.preventDefault(); void createFolder(); }}><input aria-label="新文件夹名称" value={newFolderName} onChange={event => setNewFolderName(event.target.value)} placeholder="新文件夹" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-base sm:text-sm dark:bg-zinc-900" /><button title="创建文件夹" className="btn-secondary min-h-11 min-w-11"><FolderPlus className="mx-auto h-4 w-4" /></button></form>
      </aside>
      <section className="glass-panel flex min-h-0 flex-col rounded-2xl p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap gap-2 lg:hidden">
          <select aria-label="选择材料文件夹" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base dark:bg-zinc-900" value={state === 'trashed' ? 'trash' : folderId === undefined ? 'all' : folderId === null ? 'unfiled' : folderId} onChange={event => {
            const value = event.target.value;
            setState(value === 'trash' ? 'trashed' : 'saved');
            openFolder(value === 'all' || value === 'trash' ? undefined : value === 'unfiled' ? null : value);
          }}><option value="all">全部材料</option><option value="unfiled">未整理</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.parentId ? '　' : ''}{folder.name}</option>)}<option value="trash">回收站</option></select>
          <details className="min-w-11 open:w-full"><summary className="btn-secondary flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center" title="新建文件夹"><FolderPlus className="h-4 w-4" /></summary><form className="mt-2 flex w-full gap-2" onSubmit={event => { event.preventDefault(); void createFolder(); }}><input aria-label="新文件夹名称" value={newFolderName} onChange={event => setNewFolderName(event.target.value)} placeholder="新文件夹" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-base dark:bg-zinc-900" /><button className="btn-primary min-h-11 px-3 text-sm">创建</button></form></details>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1 text-sm"><button className="min-h-11 px-2" onClick={() => openFolder(undefined)}>全部</button>{breadcrumb.map(folder => <button key={folder.id} className="min-h-11 px-2 font-bold" onClick={() => openFolder(folder.id)}> / {folder.name}</button>)}</div>{currentFolder && <button className="min-h-11 text-xs text-slate-500 underline" onClick={async () => { const name = window.prompt('新的文件夹名称', currentFolder.name); if (name?.trim()) { try { await renamePoolFolder(currentFolder.id, name.trim()); await refresh(); } catch (error) { onShowToast(errorText(error)); } } }}>重命名文件夹</button>}</div>
        {state === 'saved' && currentFolder && visibleFolders.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{visibleFolders.map(folder => <button key={folder.id} onClick={() => openFolder(folder.id)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm dark:border-zinc-700"><Folder className="h-4 w-4" />{folder.name}<ArrowRight className="h-3 w-3" /></button>)}</div>}
        <div className="mb-3 flex flex-wrap gap-2"><label className="relative min-w-[160px] flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input aria-label="搜索材料" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索文件名或标签" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-base sm:text-sm dark:bg-zinc-900" /></label>{selectedIds.length > 0 && <select aria-label="批量移动到" className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:bg-zinc-900" value="" onChange={event => { void batchMove(event.target.value === 'unfiled' ? null : event.target.value); }}><option value="">移动 {selectedIds.length} 份到…</option><option value="unfiled">未整理</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">{loading ? <p className="p-4 text-sm text-slate-500">正在加载材料…</p> : items.length === 0 ? <p className="p-4 text-sm text-slate-500">这里还没有材料。可以上传文件，或切换文件夹查看。</p> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <div key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-zinc-700"><div className="flex items-start gap-2"><input type="checkbox" aria-label={`选择 ${item.originalName}`} checked={selectedIds.includes(item.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} className="mt-1 h-5 w-5 accent-emerald-700" /><button className="min-w-0 flex-1 text-left" onClick={() => { setActiveItemId(item.id); setTagDraft(item.tags.join('，')); }}><div className="flex items-center gap-2">{item.detectedMime.startsWith('image/') ? <Image className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}<span className="truncate text-sm font-bold">{item.originalName}</span></div><p className="mt-2 text-xs text-slate-500">{formatSize(item.sizeBytes)} · {item.resourceId ? '已用于资料编辑' : '仅保存原件'}</p>{item.tags.length > 0 && <p className="mt-1 truncate text-xs text-emerald-700">{item.tags.join(' · ')}</p>}</button></div></div>)}</div>}
          {nextOffset !== null && <button className="btn-secondary mt-3 min-h-11 w-full text-sm" onClick={async () => { try { const result = await listPoolItems({ folderId, q: query.trim(), state, offset: nextOffset }); setItems(current => [...current, ...result.items]); setNextOffset(result.nextOffset); } catch (error) { onShowToast(errorText(error)); } }}>加载更多</button>}
        </div>
        {activeItem && <div className="fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-white p-4 dark:bg-zinc-950 lg:static lg:mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:border-t lg:border-slate-200 lg:bg-transparent lg:pt-3 lg:dark:border-zinc-700"><div className="flex min-h-11 items-center justify-between lg:hidden"><p className="font-bold">材料详情</p><button className="btn-secondary min-h-11 px-3 text-sm" onClick={() => setActiveItemId(null)}>关闭</button></div><div className="h-[min(38dvh,320px)] min-h-[180px] overflow-hidden">{state === 'trashed' ? <div className="grid h-full place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">恢复后可查看原件</div> : itemPreview(activeItem)}</div><div className="space-y-2"><p className="break-all text-sm font-bold">{activeItem.originalName}</p>{state === 'saved' && <a href={activeItem.contentUrl} download={activeItem.originalName} className="btn-secondary flex min-h-11 items-center justify-center text-sm">下载原件</a>}{activeItem.resourceId && <button className="btn-secondary min-h-11 w-full text-sm" onClick={() => onOpenResource(activeItem.resourceId!)}>在资料编辑打开</button>}{state === 'saved' && <><select aria-label="移动材料到文件夹" value={activeItem.folderId ?? ''} onChange={event => void saveMove(activeItem.id, event.target.value || null)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:bg-zinc-900"><option value="">未整理</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><div className="flex gap-2"><input aria-label="材料标签，用逗号分隔" value={tagDraft} onChange={event => setTagDraft(event.target.value)} placeholder="标签，用逗号分隔" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-base sm:text-sm dark:bg-zinc-900" /><button onClick={() => void applyTags()} className="btn-secondary min-h-11 px-3" title="保存标签"><Check className="h-4 w-4" /></button></div><button onClick={async () => { try { await trashPoolItem(activeItem.id); setActiveItemId(null); await refresh(); onShowToast('已移到回收站，原件仍可恢复'); } catch (error) { onShowToast(errorText(error)); } }} className="min-h-11 text-sm text-rose-600">移到回收站</button></>}{state === 'trashed' && <button className="btn-secondary min-h-11 w-full text-sm" onClick={async () => { try { await restorePoolItem(activeItem.id); setActiveItemId(null); await refresh(); } catch (error) { onShowToast(errorText(error)); } }}>恢复材料</button>}<button className="min-h-11 w-full text-sm text-slate-500" onClick={() => setActiveItemId(null)}>关闭详情</button></div></div>}
      </section>
    </div>}
  </div>;
}
