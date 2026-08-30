/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleDot,
  Edit3,
  Link2,
  LoaderCircle,
  Merge,
  Plus,
  Route,
  Search,
  X,
} from "lucide-react";
import {
  KnowledgeEntity,
  KnowledgeEntityType,
  KnowledgeFocusSnapshot,
  KnowledgeGraphSnapshot,
  KnowledgeRelationType,
} from "../../domain/types";
import {
  archiveKnowledgeNode,
  createKnowledgeNode,
  createKnowledgeRelation,
  getKnowledgeFocus,
  KnowledgeNodeInput,
  mergeKnowledgeNode,
  updateKnowledgeNode,
} from "../../services/resourceApi";
import { entityLabels, entityTones, relationLabels, resourceKindLabels } from "./knowledgeUi";

const KnowledgeGraphCanvas = lazy(() => import("./KnowledgeGraphCanvas"));
const structuralTypes = new Set<KnowledgeEntityType>(["domain", "topic", "knowledge"]);
const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-900";

interface WorkspaceProps {
  graph: KnowledgeGraphSnapshot;
  loading: boolean;
  onDataChanged: () => Promise<void>;
  onOpenSource: (resourceId: string, pageNumber: number) => void;
  onShowToast: (message: string) => void;
}

const DialogShell = ({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <div
      className="glass-panel max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl shadow-2xl"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="flex items-start justify-between border-b border-slate-200/70 px-5 py-4 dark:border-zinc-800">
        <div>
          <h3 className="font-black text-slate-900 dark:text-zinc-50">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={onClose} title="关闭" className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800">
          <X className="h-4 w-4" />
        </button>
      </header>
      {children}
    </div>
  </div>
);

const NodeDialog = ({ node, nodes, defaultSubject, onClose, onSaved, onShowToast }: {
  node?: KnowledgeEntity;
  nodes: KnowledgeEntity[];
  defaultSubject: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onShowToast: (message: string) => void;
}) => {
  const [input, setInput] = useState<KnowledgeNodeInput>(node ? {
    name: node.name,
    type: node.type,
    description: node.description,
    aliases: node.aliases,
    subject: node.subject,
    grade: node.grade,
    primaryMotherId: node.primaryMotherId,
    trainable: node.trainable,
    sortOrder: node.sortOrder,
  } : {
    name: "",
    type: "knowledge",
    description: "",
    aliases: [],
    subject: defaultSubject || "语文",
    grade: "通用",
    trainable: true,
    sortOrder: 0,
  });
  const [aliasText, setAliasText] = useState(input.aliases.join("、"));
  const [saving, setSaving] = useState(false);
  const isStructural = structuralTypes.has(input.type);
  const motherCandidates = nodes.filter((candidate) =>
    candidate.id !== node?.id &&
    candidate.subject === input.subject &&
    structuralTypes.has(candidate.type),
  );
  const update = <K extends keyof KnowledgeNodeInput>(key: K, value: KnowledgeNodeInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: KnowledgeNodeInput = {
        ...input,
        primaryMotherId: isStructural ? input.primaryMotherId : undefined,
        aliases: aliasText.split(/[、,，]/).map((value) => value.trim()).filter(Boolean),
      };
      if (node) {
        await updateKnowledgeNode(node.id, {
          ...payload,
          primaryMotherId: isStructural ? payload.primaryMotherId ?? null : null,
        });
      } else {
        await createKnowledgeNode(payload);
      }
      await onSaved();
      onShowToast(node ? "节点已更新" : "节点已加入知识库");
      onClose();
    } catch (error) {
      onShowToast(`保存失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell title={node ? "编辑节点" : "新增节点"} subtitle={node ? `稳定 ID：${node.id}` : "先确定它在知识结构中的位置"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-bold text-slate-500">名称</span>
            <input required value={input.name} onChange={(event) => update("name", event.target.value)} className={fieldClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">类型</span>
            <select value={input.type} onChange={(event) => {
              const nextType = event.target.value as KnowledgeEntityType;
              setInput((current) => ({
                ...current,
                type: nextType,
                primaryMotherId: structuralTypes.has(nextType) ? current.primaryMotherId : undefined,
                trainable: nextType === "knowledge" || nextType === "ability" ? current.trainable ?? true : false,
              }));
            }} className={fieldClass}>
              {Object.entries(entityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">学科</span>
            <input value={input.subject} onChange={(event) => update("subject", event.target.value)} className={fieldClass} />
          </label>
          {isStructural ? (
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-bold text-slate-500">主要母节点</span>
              <select value={input.primaryMotherId ?? ""} onChange={(event) => update("primaryMotherId", event.target.value || undefined)} className={fieldClass}>
                <option value="">无（作为学科根层）</option>
                {motherCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{entityLabels[candidate.type]} · {candidate.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">适用年级</span>
            <input value={input.grade} onChange={(event) => update("grade", event.target.value)} className={fieldClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">排序</span>
            <input type="number" value={input.sortOrder ?? 0} onChange={(event) => update("sortOrder", Number(event.target.value))} className={fieldClass} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-bold text-slate-500">别名</span>
            <input value={aliasText} onChange={(event) => setAliasText(event.target.value)} placeholder="用顿号分隔，供 AI 对齐使用" className={fieldClass} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-bold text-slate-500">说明</span>
            <textarea rows={3} value={input.description} onChange={(event) => update("description", event.target.value)} className={fieldClass} />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-zinc-300 sm:col-span-2">
            <input type="checkbox" checked={Boolean(input.trainable)} onChange={(event) => update("trainable", event.target.checked)} className="h-4 w-4 accent-emerald-700" />
            可被 AI 批改与学生画像作为训练目标引用
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">取消</button>
          <button disabled={saving} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}保存
          </button>
        </footer>
      </form>
    </DialogShell>
  );
};

const RelationDialog = ({ selected, nodes, onClose, onSaved, onShowToast }: {
  selected: KnowledgeEntity;
  nodes: KnowledgeEntity[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onShowToast: (message: string) => void;
}) => {
  const relationOptions = Object.entries(relationLabels).filter(([value]) => value !== "parent") as [KnowledgeRelationType, string][];
  const [targetNodeId, setTargetNodeId] = useState("");
  const [type, setType] = useState<KnowledgeRelationType>("related");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createKnowledgeRelation({ sourceNodeId: selected.id, targetNodeId, type, description });
      await onSaved();
      onShowToast("关系已建立");
      onClose();
    } catch (error) {
      onShowToast(`保存失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <DialogShell title="建立辅助关系" subtitle="知识归属请在“编辑节点”中修改主要母节点" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="space-y-4 p-5">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold dark:bg-zinc-900">起点：{selected.name}</div>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">关系</span>
            <select value={type} onChange={(event) => setType(event.target.value as KnowledgeRelationType)} className={fieldClass}>
              {relationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">目标节点</span>
            <select required value={targetNodeId} onChange={(event) => setTargetNodeId(event.target.value)} className={fieldClass}>
              <option value="">请选择</option>
              {nodes.filter((candidate) => candidate.id !== selected.id).map((candidate) =>
                <option key={candidate.id} value={candidate.id}>{entityLabels[candidate.type]} · {candidate.name}</option>,
              )}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">说明</span>
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={fieldClass} />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">取消</button>
          <button disabled={saving} className="btn-primary px-4 py-2 text-sm">建立关系</button>
        </footer>
      </form>
    </DialogShell>
  );
};

const NodePill = ({ node, onSelect }: { key?: React.Key; node: KnowledgeEntity; onSelect: (id: string) => void }) => (
  <button type="button" onClick={() => onSelect(node.id)} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900">
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-black ${entityTones[node.type]}`}>{entityLabels[node.type]}</span>
    <span className="truncate text-xs font-bold text-slate-700 dark:text-zinc-200">{node.name}</span>
  </button>
);

const Collection = ({ title, nodes, empty, onSelect }: { title: string; nodes: KnowledgeEntity[]; empty: string; onSelect: (id: string) => void }) => (
  <section>
    <h4 className="mb-2 text-[11px] font-black text-slate-500">{title} <span className="font-medium text-slate-300">{nodes.length}</span></h4>
    {nodes.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{nodes.map((node) => <NodePill key={node.id} node={node} onSelect={onSelect} />)}</div> : <p className="text-xs text-slate-400">{empty}</p>}
  </section>
);

const FocusPanel = ({ focus, loading, onSelect, onEdit, onRelation, onOpenSource }: {
  focus?: KnowledgeFocusSnapshot;
  loading: boolean;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onRelation: () => void;
  onOpenSource: (resourceId: string, pageNumber: number) => void;
}) => {
  if (loading) return <div className="grid min-h-52 place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-slate-400" /></div>;
  if (!focus) return <div className="grid min-h-52 place-items-center text-sm text-slate-400">选择一个主干节点查看它的位置</div>;
  const resourceById = new Map(focus.resources.map((resource) => [resource.id, resource]));
  return (
    <div className="divide-y divide-slate-200/70 dark:divide-zinc-800">
      <header className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold text-slate-400">
            {[...focus.motherChain, focus.node].map((node, index) => (
              <React.Fragment key={node.id}>
                {index ? <ChevronRight className="h-3 w-3" /> : null}
                <button type="button" onClick={() => onSelect(node.id)} className={node.id === focus.node.id ? "text-emerald-700" : "hover:text-slate-700"}>{node.name}</button>
              </React.Fragment>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded border px-2 py-0.5 text-[10px] font-black ${entityTones[focus.node.type]}`}>{entityLabels[focus.node.type]}</span>
            <h3 className="truncate text-lg font-black text-slate-900 dark:text-zinc-50">{focus.node.name}</h3>
            {focus.node.trainable ? <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30">可训练</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onEdit} title="编辑节点" className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"><Edit3 className="h-4 w-4" /></button>
          <button type="button" onClick={onRelation} title="建立辅助关系" className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"><Link2 className="h-4 w-4" /></button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 bg-slate-50/60 p-4 md:grid-cols-[1fr_1.15fr_1fr] dark:bg-zinc-950/20">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex items-center gap-2 text-xs font-black text-slate-500"><ArrowLeft className="h-4 w-4" />学习前需要</div>
          <div className="grid gap-2">{focus.prerequisites.length ? focus.prerequisites.map((node) => <NodePill key={node.id} node={node} onSelect={onSelect} />) : <p className="text-xs text-slate-400">暂无先修要求</p>}</div>
        </div>
        <div className="rounded-lg border-2 border-emerald-600 bg-white p-4 dark:bg-zinc-900">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-emerald-700"><CircleDot className="h-4 w-4" />当前定位</div>
          <p className="text-base font-black text-slate-900 dark:text-zinc-50">{focus.node.name}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{focus.node.description || "暂时还没有补充说明。"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex items-center gap-2 text-xs font-black text-slate-500">后续会用到<ArrowRight className="h-4 w-4" /></div>
          <div className="grid gap-2">{focus.dependents.length ? focus.dependents.map((node) => <NodePill key={node.id} node={node} onSelect={onSelect} />) : <p className="text-xs text-slate-400">暂无直接后续节点</p>}</div>
        </div>
      </section>

      <div className="grid gap-5 p-4 lg:grid-cols-2">
        <Collection title="向下细分" nodes={focus.children} empty="这个节点目前没有更细的知识点" onSelect={onSelect} />
        <Collection title="对应题型" nodes={focus.questionTypes} empty="还没有关联题型" onSelect={onSelect} />
        <Collection title="常用解法" nodes={focus.methods} empty="还没有关联解法" onSelect={onSelect} />
        <Collection title="典型例题" nodes={focus.examples} empty="还没有关联例题" onSelect={onSelect} />
        <Collection title="可观察能力" nodes={focus.abilities} empty="还没有关联能力点" onSelect={onSelect} />
        <Collection title="常见错误" nodes={focus.errors} empty="还没有关联错误类型" onSelect={onSelect} />
        <Collection title="相关知识" nodes={focus.related} empty="暂无相关知识" onSelect={onSelect} />
        <Collection title="容易混淆" nodes={focus.confusable} empty="暂无易混淆知识" onSelect={onSelect} />
      </div>

      <section className="p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-black text-slate-600"><BookOpen className="h-4 w-4" />来源定位</h4>
        {focus.sourceLinks.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {focus.sourceLinks.map((link) => {
              const resource = resourceById.get(link.resourceId);
              return (
                <button key={link.id} type="button" onClick={() => onOpenSource(link.resourceId, link.pageNumber)} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900">
                  <span className="min-w-0"><span className="block truncate text-xs font-black">{resource?.title ?? "资料来源"}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{resource ? resourceKindLabels[resource.kind] : "资料"} · 第 {link.pageNumber} 页 · {link.quote}</span></span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              );
            })}
          </div>
        ) : <p className="text-xs text-slate-400">还没有确认过的课本或教辅来源</p>}
      </section>
    </div>
  );
};

export default function KnowledgeGraphWorkspace({ graph, loading, onDataChanged, onOpenSource, onShowToast }: WorkspaceProps) {
  const subjects = useMemo(() => Array.from(new Set(graph.nodes.map((node) => node.subject).filter(Boolean))), [graph.nodes]);
  const [subject, setSubject] = useState("语文");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "domain" | "topic" | "knowledge">("all");
  const [dialog, setDialog] = useState<"create" | "edit" | "relation" | "merge" | null>(null);
  const [focus, setFocus] = useState<KnowledgeFocusSnapshot>();
  const [focusLoading, setFocusLoading] = useState(false);
  const subjectNodes = useMemo(() => graph.nodes.filter((node) => node.subject === subject && structuralTypes.has(node.type)), [graph.nodes, subject]);
  const selected = graph.nodes.find((node) => node.id === selectedId);
  const filtered = useMemo(() => subjectNodes.filter((node) =>
    (type === "all" || node.type === type) && `${node.name}${node.description}${node.aliases.join("")}`.toLowerCase().includes(query.toLowerCase()),
  ), [subjectNodes, type, query]);
  const unclassified = subjectNodes.filter((node) => node.type !== "domain" && !node.primaryMotherId);

  useEffect(() => {
    if (!subjects.length) return;
    if (!subjects.includes(subject)) setSubject(subjects[0]);
  }, [subjects, subject]);
  useEffect(() => {
    if (subjectNodes.some((node) => node.id === selectedId)) return;
    const first = subjectNodes.find((node) => node.type === "domain" && !node.primaryMotherId) ?? subjectNodes[0];
    setSelectedId(first?.id ?? "");
  }, [subjectNodes, selectedId]);
  useEffect(() => {
    if (!selectedId) {
      setFocus(undefined);
      return;
    }
    let cancelled = false;
    setFocusLoading(true);
    void getKnowledgeFocus(selectedId)
      .then((next) => { if (!cancelled) setFocus(next); })
      .catch((error) => { if (!cancelled) onShowToast(`读取节点失败：${error instanceof Error ? error.message : "未知错误"}`); })
      .finally(() => { if (!cancelled) setFocusLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, onShowToast]);

  const archiveSelected = async () => {
    if (!selected || !window.confirm(`归档“${selected.name}”？稳定 ID 和历史记录仍会保留。`)) return;
    try {
      await archiveKnowledgeNode(selected.id);
      await onDataChanged();
      onShowToast("节点已归档");
    } catch (error) {
      onShowToast(`归档失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  return (
    <div className="grid min-h-[760px] grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="glass-panel order-2 flex max-h-[620px] flex-col overflow-hidden rounded-xl xl:order-1 xl:max-h-none">
        <div className="space-y-3 border-b border-slate-200/70 p-3 dark:border-zinc-800">
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">选择学科</span>
              <select value={subject} onChange={(event) => setSubject(event.target.value)} className={fieldClass}>
                {subjects.map((value) => <option key={value} value={value}>{value}知识主干</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setDialog("create")} title="新增节点" className="btn-primary grid h-9 w-9 shrink-0 place-items-center"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识主干" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-900" />
          </div>
          <div className="grid grid-cols-4 gap-1">
            {([['all', '全部'], ['domain', '板块'], ['topic', '主题'], ['knowledge', '知识点']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setType(value)} className={`rounded-md px-1 py-1.5 text-[10px] font-bold ${type === value ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-slate-100 text-slate-500 dark:bg-zinc-800"}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 pb-2 pt-3 text-[10px] font-black text-slate-400"><span>主干索引</span><span>{filtered.length}</span></div>
          <div className="divide-y divide-slate-200/60 dark:divide-zinc-800">
            {filtered.map((node) => (
              <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} className={`w-full border-l-2 px-3 py-3 text-left ${selectedId === node.id ? "border-emerald-700 bg-emerald-700/10" : "border-transparent hover:bg-slate-50 dark:hover:bg-zinc-900"}`}>
                <div className="flex items-center gap-2"><span className={`rounded border px-1.5 py-0.5 text-[9px] font-black ${entityTones[node.type]}`}>{entityLabels[node.type]}</span><span className="truncate text-xs font-black">{node.name}</span></div>
                <p className="mt-1.5 truncate text-[10px] text-slate-400">{node.description || "暂无说明"}</p>
              </button>
            ))}
          </div>
          {unclassified.length ? (
            <div className="m-3 border-t border-amber-200 pt-3">
              <p className="mb-2 flex items-center gap-1 text-[10px] font-black text-amber-700"><Route className="h-3 w-3" />待归类 {unclassified.length}</p>
              <div className="grid gap-1">{unclassified.map((node) => <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} className="truncate rounded-md bg-amber-50 px-2 py-1.5 text-left text-[11px] font-bold text-amber-800">{node.name}</button>)}</div>
            </div>
          ) : null}
        </div>
        {selected ? (
          <div className="grid grid-cols-4 border-t border-slate-200/70 p-2 dark:border-zinc-800">
            <button type="button" onClick={() => setDialog("edit")} title="编辑节点" className="grid h-8 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"><Edit3 className="h-4 w-4" /></button>
            <button type="button" onClick={() => setDialog("relation")} title="辅助关系" className="grid h-8 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"><Link2 className="h-4 w-4" /></button>
            <button type="button" onClick={() => setDialog("merge")} title="合并节点" className="grid h-8 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"><Merge className="h-4 w-4" /></button>
            <button type="button" onClick={() => void archiveSelected()} title="归档节点" className="grid h-8 place-items-center rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"><Archive className="h-4 w-4" /></button>
          </div>
        ) : null}
      </aside>

      <div className="order-1 min-w-0 space-y-4 xl:order-2">
        <section className="glass-panel min-h-[590px] overflow-hidden rounded-xl">
          {subjectNodes.length ? (
            <Suspense fallback={<div className="grid min-h-[590px] place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-slate-400" /></div>}>
              <KnowledgeGraphCanvas subject={subject} nodes={subjectNodes} selectedId={selectedId} onSelect={setSelectedId} />
            </Suspense>
          ) : <div className="grid min-h-[590px] place-items-center text-sm text-slate-400">这个学科还没有知识主干</div>}
        </section>
        <section className="glass-panel overflow-hidden rounded-xl">
          <FocusPanel focus={focus} loading={focusLoading || loading} onSelect={setSelectedId} onEdit={() => setDialog("edit")} onRelation={() => setDialog("relation")} onOpenSource={onOpenSource} />
        </section>
      </div>

      {dialog === "create" ? <NodeDialog nodes={graph.nodes} defaultSubject={subject} onClose={() => setDialog(null)} onSaved={onDataChanged} onShowToast={onShowToast} /> : null}
      {dialog === "edit" && selected ? <NodeDialog node={selected} nodes={graph.nodes} defaultSubject={subject} onClose={() => setDialog(null)} onSaved={onDataChanged} onShowToast={onShowToast} /> : null}
      {dialog === "relation" && selected ? <RelationDialog selected={selected} nodes={graph.nodes} onClose={() => setDialog(null)} onSaved={onDataChanged} onShowToast={onShowToast} /> : null}
      {dialog === "merge" && selected ? (
        <MergeDialog selected={selected} nodes={graph.nodes} onClose={() => setDialog(null)} onSaved={onDataChanged} onShowToast={onShowToast} />
      ) : null}
    </div>
  );
}

const MergeDialog = ({ selected, nodes, onClose, onSaved, onShowToast }: {
  selected: KnowledgeEntity;
  nodes: KnowledgeEntity[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onShowToast: (message: string) => void;
}) => {
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await mergeKnowledgeNode(selected.id, targetId);
      await onSaved();
      onShowToast("节点已合并，旧 ID 已保留追踪");
      onClose();
    } catch (error) {
      onShowToast(`合并失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <DialogShell title="合并重复节点" subtitle={`将“${selected.name}”合并到保留节点`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="p-5">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">保留哪个节点</span>
            <select required value={targetId} onChange={(event) => setTargetId(event.target.value)} className={fieldClass}>
              <option value="">请选择</option>
              {nodes.filter((node) => node.id !== selected.id && node.subject === selected.subject).map((node) => <option key={node.id} value={node.id}>{entityLabels[node.type]} · {node.name}</option>)}
            </select>
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">取消</button>
          <button disabled={saving} className="btn-primary px-4 py-2 text-sm">确认合并</button>
        </footer>
      </form>
    </DialogShell>
  );
};
