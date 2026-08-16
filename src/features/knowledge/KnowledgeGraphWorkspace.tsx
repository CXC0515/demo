/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  BookOpen,
  ChevronRight,
  Edit3,
  GitBranch,
  Link2,
  LoaderCircle,
  Merge,
  Network,
  Plus,
  Search,
  Tag,
  X,
} from "lucide-react";
import {
  KnowledgeEntity,
  KnowledgeEntityType,
  KnowledgeGraphSnapshot,
  KnowledgeRelation,
  KnowledgeRelationType,
} from "../../domain/types";
import {
  archiveKnowledgeNode,
  createKnowledgeNode,
  createKnowledgeRelation,
  KnowledgeNodeInput,
  mergeKnowledgeNode,
  updateKnowledgeNode,
} from "../../services/resourceApi";
import {
  entityLabels,
  entityTones,
  relationLabels,
  resourceKindLabels,
} from "./knowledgeUi";

interface KnowledgeGraphWorkspaceProps {
  graph: KnowledgeGraphSnapshot;
  loading: boolean;
  onDataChanged: () => Promise<void>;
  onOpenSource: (resourceId: string, pageNumber: number) => void;
  onShowToast: (message: string) => void;
}

const fieldClass =
  "w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 text-sm outline-none focus:border-emerald-600";

const NodeDialog = ({
  node,
  onClose,
  onSaved,
  onShowToast,
}: {
  node?: KnowledgeEntity;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onShowToast: (message: string) => void;
}) => {
  const [input, setInput] = useState<KnowledgeNodeInput>(
    node
      ? {
          name: node.name,
          type: node.type,
          description: node.description,
          aliases: node.aliases,
          subject: node.subject,
          grade: node.grade,
        }
      : {
          name: "",
          type: "knowledge",
          description: "",
          aliases: [],
          subject: "语文",
          grade: "通用",
        },
  );
  const [aliasText, setAliasText] = useState(input.aliases.join("、"));
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...input,
        aliases: aliasText
          .split(/[、,，]/)
          .map((value) => value.trim())
          .filter(Boolean),
      };
      if (node) await updateKnowledgeNode(node.id, payload);
      else await createKnowledgeNode(payload);
      await onSaved();
      onShowToast(node ? "节点已更新" : "节点已加入图谱");
      onClose();
    } catch (error) {
      onShowToast(
        `保存失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setSaving(false);
    }
  };
  const update = <K extends keyof KnowledgeNodeInput>(
    key: K,
    value: KnowledgeNodeInput[K],
  ) => setInput((current) => ({ ...current, [key]: value }));
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm grid place-items-center p-4"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-zinc-800 flex justify-between">
          <div>
            <h3 className="font-black">{node ? "编辑节点" : "新增节点"}</h3>
            {node && (
              <p className="text-xs text-slate-400 mt-0.5">
                稳定 ID：{node.id}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} title="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <label className="col-span-2 space-y-1">
            <span className="text-xs font-bold text-slate-500">名称</span>
            <input
              required
              value={input.name}
              onChange={(event) => update("name", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">类型</span>
            <select
              value={input.type}
              onChange={(event) =>
                update("type", event.target.value as KnowledgeEntityType)
              }
              className={fieldClass}
            >
              {Object.entries(entityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">学科</span>
            <input
              value={input.subject}
              onChange={(event) => update("subject", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">适用年级</span>
            <input
              value={input.grade}
              onChange={(event) => update("grade", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">别名</span>
            <input
              value={aliasText}
              onChange={(event) => setAliasText(event.target.value)}
              placeholder="用顿号分隔"
              className={fieldClass}
            />
          </label>
          <label className="col-span-2 space-y-1">
            <span className="text-xs font-bold text-slate-500">说明</span>
            <textarea
              rows={4}
              value={input.description}
              onChange={(event) => update("description", event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-slate-200/70 dark:border-zinc-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-4 py-2 text-sm"
          >
            取消
          </button>
          <button
            disabled={saving}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            {saving && <LoaderCircle className="w-4 h-4 animate-spin" />}保存
          </button>
        </div>
      </form>
    </div>
  );
};

const RelationDialog = ({
  selected,
  nodes,
  onClose,
  onSaved,
  onShowToast,
}: {
  selected: KnowledgeEntity;
  nodes: KnowledgeEntity[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onShowToast: (message: string) => void;
}) => {
  const [targetNodeId, setTargetNodeId] = useState("");
  const [type, setType] = useState<KnowledgeRelationType>("related");
  const [description, setDescription] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createKnowledgeRelation({
        sourceNodeId: selected.id,
        targetNodeId,
        type,
        description,
      });
      await onSaved();
      onShowToast("关系已建立");
      onClose();
    } catch (error) {
      onShowToast(
        `保存失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm grid place-items-center p-4"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        className="glass-panel w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-zinc-800 flex justify-between">
          <h3 className="font-black">建立关系</h3>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 text-sm font-bold">
            {selected.name}
          </div>
          <label className="space-y-1 block">
            <span className="text-xs font-bold text-slate-500">关系</span>
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as KnowledgeRelationType)
              }
              className={fieldClass}
            >
              {Object.entries(relationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-bold text-slate-500">目标节点</span>
            <select
              required
              value={targetNodeId}
              onChange={(event) => setTargetNodeId(event.target.value)}
              className={fieldClass}
            >
              <option value="">请选择...</option>
              {nodes
                .filter((node) => node.id !== selected.id)
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {entityLabels[node.type]} · {node.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-bold text-slate-500">说明</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-slate-200/70 dark:border-zinc-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-4 py-2 text-sm"
          >
            取消
          </button>
          <button className="btn-primary px-4 py-2 text-sm">建立关系</button>
        </div>
      </form>
    </div>
  );
};

export default function KnowledgeGraphWorkspace({
  graph,
  loading,
  onDataChanged,
  onOpenSource,
  onShowToast,
}: KnowledgeGraphWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(graph.nodes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | KnowledgeEntityType>("all");
  const [dialog, setDialog] = useState<
    "create" | "edit" | "relation" | "merge" | null
  >(null);
  const selected =
    graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0];
  const filtered = useMemo(
    () =>
      graph.nodes.filter(
        (node) =>
          (type === "all" || node.type === type) &&
          `${node.name}${node.description}${node.aliases.join("")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [graph.nodes, query, type],
  );
  const connected = selected
    ? graph.relations
        .reduce<
          Array<{
            relation: KnowledgeRelation;
            node: KnowledgeEntity | undefined;
            direction: "in" | "out";
          }>
        >((items, relation) => {
          if (relation.sourceNodeId === selected.id)
            items.push({
              relation,
              node: graph.nodes.find(
                (node) => node.id === relation.targetNodeId,
              ),
              direction: "out",
            });
          if (relation.targetNodeId === selected.id)
            items.push({
              relation,
              node: graph.nodes.find(
                (node) => node.id === relation.sourceNodeId,
              ),
              direction: "in",
            });
          return items;
        }, [])
        .filter((item) => item.node)
    : [];
  const sourceLinks = selected
    ? graph.sourceLinks.filter((link) => link.nodeId === selected.id)
    : [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(240px,1fr)_280px] 2xl:grid-cols-[300px_minmax(0,1fr)_350px] gap-4 min-h-[690px]">
      <aside className="glass-panel rounded-2xl overflow-hidden flex flex-col max-h-[420px] lg:max-h-none">
        <div className="p-3 border-b border-slate-200/70 dark:border-zinc-800 space-y-3">
          <button
            onClick={() => setDialog("create")}
            className="btn-primary w-full py-2.5 text-sm flex justify-center items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增节点
          </button>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索名称、别名、说明"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-sm outline-none"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            <button
              onClick={() => setType("all")}
              className={`px-2 py-1 rounded-md text-[11px] whitespace-nowrap ${type === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 dark:bg-zinc-800"}`}
            >
              全部
            </button>
            {Object.entries(entityLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setType(value as KnowledgeEntityType)}
                className={`px-2 py-1 rounded-md text-[11px] whitespace-nowrap ${type === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 dark:bg-zinc-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-slate-200/60 dark:divide-zinc-800/70">
          {filtered.map((node) => (
            <button
              key={node.id}
              onClick={() => setSelectedId(node.id)}
              className={`w-full px-3.5 py-3 text-left ${selected?.id === node.id ? "bg-emerald-700/10 border-l-2 border-emerald-700" : "hover:bg-slate-50 dark:hover:bg-zinc-900/50 border-l-2 border-transparent"}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${entityTones[node.type]}`}
                >
                  {entityLabels[node.type]}
                </span>
                <span className="text-sm font-bold truncate">{node.name}</span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-1.5">
                {node.description || "暂无说明"}
              </p>
            </button>
          ))}
          {loading && (
            <LoaderCircle className="w-5 h-5 animate-spin mx-auto mt-10 text-slate-400" />
          )}
        </div>
      </aside>

      <main className="glass-panel rounded-2xl overflow-hidden flex flex-col min-w-0">
        {!selected ? (
          <div className="h-full grid place-items-center text-sm text-slate-400">
            暂无知识节点
          </div>
        ) : (
          <>
            <header className="px-5 py-4 border-b border-slate-200/70 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-400">关系网络</p>
                <h3 className="font-black text-lg mt-0.5">{selected.name}</h3>
              </div>
              <span className="text-xs text-slate-400">
                {connected.length} 条关系
              </span>
            </header>
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto py-4">
                <div className="relative border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white grid place-items-center">
                      <Network className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${entityTones[selected.type]}`}
                      >
                        {entityLabels[selected.type]}
                      </span>
                      <p className="font-black mt-1 truncate">
                        {selected.name}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-300 dark:bg-zinc-700 mx-auto" />
                {connected.length ? (
                  <div className="grid 2xl:grid-cols-2 gap-3">
                    {connected.map(
                      ({ relation, node, direction }) =>
                        node && (
                          <button
                            key={relation.id}
                            onClick={() => setSelectedId(node.id)}
                            className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-left hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black text-emerald-700">
                                {direction === "in"
                                  ? `${relationLabels[relation.type]} → 当前`
                                  : `当前 → ${relationLabels[relation.type]}`}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span
                                className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${entityTones[node.type]}`}
                              >
                                {entityLabels[node.type]}
                              </span>
                              <span className="text-sm font-bold break-words">
                                {node.name}
                              </span>
                            </div>
                            {relation.description && (
                              <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                                {relation.description}
                              </p>
                            )}
                          </button>
                        ),
                    )}
                  </div>
                ) : (
                  <div className="py-14 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                    <GitBranch className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="text-sm text-slate-400 mt-2">暂无关系</p>
                    <button
                      onClick={() => setDialog("relation")}
                      className="text-xs font-bold text-emerald-700 mt-2"
                    >
                      建立第一条关系
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <aside className="glass-panel rounded-2xl overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="p-4 border-b border-slate-200/70 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-black">节点详情</h3>
              <div className="flex">
                <button
                  onClick={() => setDialog("edit")}
                  className="w-8 h-8 rounded-lg grid place-items-center hover:bg-slate-100 dark:hover:bg-zinc-800"
                  title="编辑"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDialog("relation")}
                  className="w-8 h-8 rounded-lg grid place-items-center hover:bg-slate-100 dark:hover:bg-zinc-800"
                  title="建立关系"
                >
                  <Link2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-1 rounded-md border text-[10px] font-bold ${entityTones[selected.type]}`}
                  >
                    {entityLabels[selected.type]}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    v{selected.version}
                  </span>
                </div>
                <h3 className="text-xl font-black mt-3">{selected.name}</h3>
                <p className="text-sm leading-6 text-slate-500 mt-2">
                  {selected.description || "暂无说明"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60">
                  <span className="text-slate-400 block">学科</span>
                  <span className="font-bold block mt-1">
                    {selected.subject || "通用"}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60">
                  <span className="text-slate-400 block">年级</span>
                  <span className="font-bold block mt-1">
                    {selected.grade || "通用"}
                  </span>
                </div>
              </div>
              {!!selected.aliases.length && (
                <div>
                  <p className="text-xs font-black text-slate-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    别名
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selected.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="px-2 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 text-xs"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-black text-slate-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  资料来源
                </p>
                <div className="mt-2 space-y-2">
                  {sourceLinks.map((link) => {
                    const resource = graph.resources.find(
                      (item) => item.id === link.resourceId,
                    );
                    return (
                      <button
                        key={link.id}
                        onClick={() =>
                          onOpenSource(link.resourceId, link.pageNumber)
                        }
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-zinc-800 text-left hover:border-emerald-500"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold truncate">
                            {resource?.title ?? "未知资料"}
                          </span>
                          <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-700" />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {resource ? resourceKindLabels[resource.kind] : ""} ·
                          第 {link.pageNumber} 页
                          {link.isPrimary ? " · 主要来源" : ""}
                        </p>
                        <p className="text-xs text-slate-500 mt-2 line-clamp-3">
                          {link.quote}
                        </p>
                      </button>
                    );
                  })}
                  {!sourceLinks.length && (
                    <p className="text-xs text-slate-400 py-4">
                      暂无已确认来源
                    </p>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200/70 dark:border-zinc-800 flex items-center justify-between">
                <button
                  onClick={() => setDialog("merge")}
                  className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1.5"
                >
                  <Merge className="w-3.5 h-3.5" />
                  合并节点
                </button>
                <button
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `归档“${selected.name}”？稳定 ID 和历史记录会保留。`,
                      )
                    )
                      return;
                    try {
                      await archiveKnowledgeNode(selected.id);
                      await onDataChanged();
                      onShowToast("节点已归档");
                    } catch (error) {
                      onShowToast(
                        `归档失败：${error instanceof Error ? error.message : "未知错误"}`,
                      );
                    }
                  }}
                  className="text-xs text-rose-500 flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  归档
                </button>
              </div>
            </div>
          </>
        ) : null}
      </aside>
      {(dialog === "create" || dialog === "edit") && (
        <NodeDialog
          node={dialog === "edit" ? selected : undefined}
          onClose={() => setDialog(null)}
          onSaved={onDataChanged}
          onShowToast={onShowToast}
        />
      )}
      {dialog === "relation" && selected && (
        <RelationDialog
          selected={selected}
          nodes={graph.nodes}
          onClose={() => setDialog(null)}
          onSaved={onDataChanged}
          onShowToast={onShowToast}
        />
      )}
      {dialog === "merge" && selected && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm grid place-items-center p-4"
          onMouseDown={() => setDialog(null)}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="glass-panel w-full max-w-md rounded-2xl p-5 shadow-2xl"
          >
            <h3 className="font-black">合并“{selected.name}”</h3>
            <p className="text-xs text-slate-400 mt-1">
              来源和关系将迁移，原稳定 ID 保留为已合并状态。
            </p>
            <div className="mt-4 max-h-72 overflow-y-auto space-y-1">
              {graph.nodes
                .filter((node) => node.id !== selected.id)
                .map((node) => (
                  <button
                    key={node.id}
                    onClick={async () => {
                      try {
                        await mergeKnowledgeNode(selected.id, node.id);
                        await onDataChanged();
                        setSelectedId(node.id);
                        setDialog(null);
                        onShowToast(`已合并到“${node.name}”`);
                      } catch (error) {
                        onShowToast(
                          `合并失败：${error instanceof Error ? error.message : "未知错误"}`,
                        );
                      }
                    }}
                    className="w-full p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900 flex items-center gap-2 text-left"
                  >
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold ${entityTones[node.type]}`}
                    >
                      {entityLabels[node.type]}
                    </span>
                    <span className="text-sm font-bold">{node.name}</span>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setDialog(null)}
              className="btn-secondary w-full py-2 mt-4 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
