/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  Eye,
  FileText,
  Filter,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  DiscoverySuggestion,
  KnowledgeEntity,
  LibraryResource,
  ResourceDetail,
  ResourceKind,
} from "../../domain/types";
import {
  analyzeLibraryResource,
  batchReviewSuggestions,
  deleteLibraryResource,
  ResourceMetadataInput,
  reviewSuggestion,
  updateLibraryResource,
  uploadLibraryResource,
} from "../../services/resourceApi";
import {
  entityLabels,
  entityTones,
  resourceKindLabels,
  resourceStatusLabels,
  resourceStatusTones,
} from "./knowledgeUi";

interface ResourceLibraryEditorProps {
  resources: LibraryResource[];
  detail: ResourceDetail | null;
  nodes: KnowledgeEntity[];
  selectedPage: number;
  loading: boolean;
  onSelectResource: (id: string) => void;
  onOpenPage: (page: number) => void;
  onDataChanged: (resourceId?: string) => Promise<void>;
  onShowToast: (message: string) => void;
}

const emptyMetadata: ResourceMetadataInput = {
  title: "",
  kind: "supplement",
  subject: "语文",
  grade: "七年级",
  publisher: "",
  edition: "",
  isPrimary: false,
};

const fieldClass =
  "w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 text-sm outline-none focus:border-emerald-600";

const describeParseError = (code?: string) =>
  ({
    PADDLEOCR_NOT_CONFIGURED:
      "尚未配置文档识别服务，请先在系统环境中配置 PaddleOCR。",
    PADDLEOCR_AUTH_FAILED: "文档识别服务鉴权失败，请检查访问令牌。",
    PADDLEOCR_RATE_LIMITED: "文档识别服务当前繁忙，请稍后重试。",
    PADDLEOCR_TIMEOUT: "本次文档识别超时，可缩小页码范围后重试。",
    PADDLEOCR_PARSE_FAILED: "文档识别失败，请稍后重试或更换页码范围。",
    MODEL_REQUEST_FAILED: "内容分析服务暂时不可用，已保留 OCR 内容。",
  })[code ?? ""] ?? "解析未完成，请重试。";

const MetadataDialog = ({
  resource,
  onClose,
  onSaved,
  onShowToast,
}: {
  resource?: LibraryResource;
  onClose: () => void;
  onSaved: (resourceId: string) => Promise<void>;
  onShowToast: (message: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [metadata, setMetadata] = useState<ResourceMetadataInput>(
    resource
      ? {
          title: resource.title,
          kind: resource.kind,
          subject: resource.subject,
          grade: resource.grade,
          publisher: resource.publisher,
          edition: resource.edition,
          isPrimary: resource.isPrimary,
        }
      : emptyMetadata,
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resource && !file) {
      onShowToast("请选择 PDF 文件");
      return;
    }
    setSaving(true);
    try {
      const saved = resource
        ? await updateLibraryResource(resource.id, metadata)
        : await uploadLibraryResource(file!, metadata);
      await onSaved(saved.id);
      onShowToast(resource ? "资料信息已更新" : "资料已上传");
      onClose();
    } catch (error) {
      onShowToast(
        `保存失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setSaving(false);
    }
  };
  const update = <K extends keyof ResourceMetadataInput>(
    key: K,
    value: ResourceMetadataInput[K],
  ) => setMetadata((current) => ({ ...current, [key]: value }));
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        className="glass-panel w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900 dark:text-slate-50">
              {resource ? "编辑资料" : "上传资料"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {resource ? resource.fileName : "PDF 最大 500 MB"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {!resource && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="col-span-2 h-28 border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors grid place-items-center text-center"
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected && !metadata.title)
                    update("title", selected.name.replace(/\.pdf$/i, ""));
                }}
              />
              <span>
                <Upload className="w-6 h-6 mx-auto text-emerald-700 mb-2" />
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                  {file?.name ?? "选择 PDF"}
                </span>
              </span>
            </button>
          )}
          <label className="col-span-2 space-y-1">
            <span className="text-xs font-bold text-slate-500">资料名称</span>
            <input
              required
              value={metadata.title}
              onChange={(event) => update("title", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">资料类型</span>
            <select
              value={metadata.kind}
              onChange={(event) =>
                update("kind", event.target.value as ResourceKind)
              }
              className={fieldClass}
            >
              {Object.entries(resourceKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">学科</span>
            <input
              value={metadata.subject}
              onChange={(event) => update("subject", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">年级</span>
            <input
              value={metadata.grade}
              onChange={(event) => update("grade", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">出版社</span>
            <input
              value={metadata.publisher}
              onChange={(event) => update("publisher", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">版本</span>
            <input
              value={metadata.edition}
              onChange={(event) => update("edition", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm font-bold text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={metadata.isPrimary}
              onChange={(event) => update("isPrimary", event.target.checked)}
              className="accent-emerald-700"
            />
            设为主要来源
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
            {saving && <LoaderCircle className="w-4 h-4 animate-spin" />}
            {resource ? "保存" : "上传"}
          </button>
        </div>
      </form>
    </div>
  );
};

const SuggestionItem = ({
  item,
  nodes,
  onReview,
  selected,
  onToggle,
}: {
  item: DiscoverySuggestion;
  nodes: KnowledgeEntity[];
  onReview: (
    decision: "accepted" | "ignored" | "merged",
    target?: string,
  ) => void;
  selected: boolean;
  onToggle: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");
  const entityType = [
    "knowledge",
    "question-type",
    "method",
    "example",
    "ability",
    "error",
  ].includes(item.proposedType)
    ? (item.proposedType as KnowledgeEntity["type"])
    : "knowledge";
  return (
    <div className="border-b border-slate-200/70 dark:border-zinc-800 last:border-0 py-3">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 accent-emerald-700"
        />
        <button
          onClick={() => setExpanded((value) => !value)}
          className="min-w-0 flex-1 text-left"
        >
          <span
            className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${entityTones[entityType]}`}
          >
            {item.kind === "source-link"
              ? "已有匹配"
              : entityLabels[entityType]}
          </span>
          <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 mt-1 truncate">
            {item.proposedName}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5">
            可信度 {Math.round(item.confidence * 100)}%
          </span>
        </button>
        <button
          onClick={() => onReview("accepted")}
          className="w-8 h-8 rounded-lg grid place-items-center text-emerald-700 hover:bg-emerald-50"
          title="同意"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => onReview("ignored")}
          className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-slate-100"
          title="忽略"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {expanded && (
        <div className="ml-6 mt-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <p>{item.description || "暂无说明"}</p>
          <p className="text-slate-400">{item.rationale}</p>
          {(item.kind === "node" || item.kind === "source-link") && (
            <div className="flex gap-2">
              <select
                value={mergeTarget}
                onChange={(event) => setMergeTarget(event.target.value)}
                className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              >
                <option value="">合并到已有节点...</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {entityLabels[node.type]} · {node.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!mergeTarget}
                onClick={() => onReview("merged", mergeTarget)}
                className="btn-secondary px-3 disabled:opacity-40"
              >
                合并
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ResourceLibraryEditor({
  resources,
  detail,
  nodes,
  selectedPage,
  loading,
  onSelectResource,
  onOpenPage,
  onDataChanged,
  onShowToast,
}: ResourceLibraryEditorProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | ResourceKind>("all");
  const [dialog, setDialog] = useState<"upload" | "edit" | null>(null);
  const [inspectorTab, setInspectorTab] = useState<
    "overview" | "structure" | "review"
  >("overview");
  const [pageStart, setPageStart] = useState(1);
  const [pageEnd, setPageEnd] = useState(20);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const filtered = useMemo(
    () =>
      resources.filter(
        (resource) =>
          (kind === "all" || resource.kind === kind) &&
          `${resource.title}${resource.fileName}${resource.tags.join("")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [kind, query, resources],
  );
  const pending =
    detail?.suggestions.filter((item) => item.status === "pending") ?? [];
  const runAnalysis = async () => {
    if (!detail) return;
    try {
      await analyzeLibraryResource(detail.id, pageStart, pageEnd);
      await onDataChanged(detail.id);
      onShowToast(`正在解析第 ${pageStart}–${pageEnd} 页`);
    } catch (error) {
      onShowToast(
        `无法开始解析：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  };
  const review = async (
    id: string,
    decision: "accepted" | "ignored" | "merged",
    target?: string,
  ) => {
    try {
      await reviewSuggestion(id, decision, target);
      await onDataChanged(detail?.id);
      onShowToast(
        decision === "accepted"
          ? "已加入知识图谱"
          : decision === "merged"
            ? "已合并到已有节点"
            : "已忽略",
      );
    } catch (error) {
      onShowToast(
        `审核失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  };
  const batchReview = async (decision: "accepted" | "ignored") => {
    if (!selectedSuggestions.length) return;
    try {
      await batchReviewSuggestions(selectedSuggestions, decision);
      setSelectedSuggestions([]);
      await onDataChanged(detail?.id);
      onShowToast(`已处理 ${selectedSuggestions.length} 项`);
    } catch (error) {
      onShowToast(
        `批量审核失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)] gap-4 min-h-[690px]">
      <aside className="glass-panel rounded-2xl overflow-hidden flex flex-col min-h-[320px] max-h-[420px] lg:min-h-[690px] lg:max-h-none">
        <div className="p-3 border-b border-slate-200/70 dark:border-zinc-800 space-y-3">
          <button
            onClick={() => setDialog("upload")}
            className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            上传资料
          </button>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索资料"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
              className="flex-1 bg-transparent text-xs text-slate-500 outline-none"
            >
              <option value="all">全部资料</option>
              {Object.entries(resourceKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">{filtered.length}</span>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-slate-200/60 dark:divide-zinc-800/70">
          {filtered.map((resource) => (
            <button
              key={resource.id}
              onClick={() => onSelectResource(resource.id)}
              className={`w-full p-3.5 text-left transition-colors ${detail?.id === resource.id ? "bg-emerald-700/10 border-l-2 border-emerald-700" : "hover:bg-slate-50 dark:hover:bg-zinc-900/50 border-l-2 border-transparent"}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-zinc-800 grid place-items-center shrink-0">
                  <FileText className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2">
                    {resource.title}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">
                      {resourceKindLabels[resource.kind]}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${resourceStatusTones[resource.status]}`}
                    >
                      {resourceStatusLabels[resource.status]}
                    </span>
                    {resource.isPrimary && (
                      <span className="text-[10px] font-bold text-emerald-700">
                        主要来源
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 mt-1" />
              </div>
            </button>
          ))}
          {!filtered.length && (
            <div className="py-16 text-center text-sm text-slate-400">
              <BookOpen className="w-7 h-7 mx-auto mb-2 opacity-50" />
              暂无资料
            </div>
          )}
        </div>
      </aside>

      <section className="glass-panel rounded-2xl overflow-hidden min-w-0">
        {loading && !detail ? (
          <div className="h-full grid place-items-center text-slate-400">
            <LoaderCircle className="w-6 h-6 animate-spin" />
          </div>
        ) : !detail ? (
          <div className="h-full min-h-[690px] grid place-items-center text-center">
            <div>
              <FileText className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-bold text-slate-600 dark:text-slate-300 mt-3">
                选择或上传一份资料
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <header className="px-4 py-3 border-b border-slate-200/70 dark:border-zinc-800 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 dark:text-slate-50 truncate">
                    {detail.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${resourceStatusTones[detail.status]}`}
                  >
                    {resourceStatusLabels[detail.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {detail.subject || "未分类"} · {detail.grade || "全年级"} ·{" "}
                  {detail.pageCount ?? 0} 页
                </p>
              </div>
              <button
                onClick={() => setDialog("edit")}
                className="w-9 h-9 rounded-lg grid place-items-center hover:bg-slate-100 dark:hover:bg-zinc-800"
                title="编辑资料"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm(`删除“${detail.title}”？`)) return;
                  try {
                    await deleteLibraryResource(detail.id);
                    await onDataChanged();
                    onShowToast("资料已删除");
                  } catch (error) {
                    onShowToast(
                      `删除失败：${error instanceof Error ? error.message : "未知错误"}`,
                    );
                  }
                }}
                className="w-9 h-9 rounded-lg grid place-items-center text-rose-500 hover:bg-rose-50"
                title="删除资料"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </header>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px] flex-1 min-h-0">
              <div className="bg-slate-200/50 dark:bg-zinc-950 p-3 min-h-[580px] relative">
                <div className="absolute z-10 left-5 top-5 px-2.5 py-1.5 rounded-lg bg-slate-950/75 text-white text-xs flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />第 {selectedPage} 页
                </div>
                <object
                  key={`${detail.id}-${selectedPage}`}
                  data={`${detail.publicUrl}#page=${selectedPage}&view=FitH`}
                  type="application/pdf"
                  className="w-full h-full min-h-[580px] rounded-lg bg-white shadow-sm"
                >
                  <a
                    href={`${detail.publicUrl}#page=${selectedPage}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700"
                  >
                    打开 PDF
                  </a>
                </object>
              </div>
              <aside className="border-l border-slate-200/70 dark:border-zinc-800 min-h-[580px] flex flex-col">
                <div className="grid grid-cols-3 border-b border-slate-200/70 dark:border-zinc-800">
                  {(
                    [
                      ["overview", "概览"],
                      ["structure", "结构"],
                      ["review", `待审核 ${pending.length}`],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setInspectorTab(value)}
                      className={`py-3 text-xs font-bold border-b-2 ${inspectorTab === value ? "border-emerald-700 text-emerald-700" : "border-transparent text-slate-400"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  {inspectorTab === "overview" && (
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs font-black text-slate-400 mb-2">
                          AI 摘要
                        </p>
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {detail.summary || "尚未解析"}
                        </p>
                      </div>
                      {!!detail.tags.length && (
                        <div className="flex flex-wrap gap-1.5">
                          {detail.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 text-xs text-slate-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="border-t border-slate-200/70 dark:border-zinc-800 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-slate-400">
                            解析页码
                          </p>
                          {detail.status === "processing" && (
                            <span className="text-xs text-blue-600 flex items-center gap-1">
                              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                              处理中
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={detail.pageCount ?? 1}
                            value={pageStart}
                            onChange={(event) =>
                              setPageStart(Number(event.target.value))
                            }
                            className={fieldClass}
                          />
                          <span className="text-slate-400">至</span>
                          <input
                            type="number"
                            min={1}
                            max={Math.min(
                              detail.pageCount ?? 1,
                              pageStart + 39,
                            )}
                            value={pageEnd}
                            onChange={(event) =>
                              setPageEnd(Number(event.target.value))
                            }
                            className={fieldClass}
                          />
                        </div>
                        <button
                          onClick={runAnalysis}
                          disabled={detail.status === "processing"}
                          className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4" />
                          {detail.chunks.length ? "重新解析所选页" : "开始解析"}
                        </button>
                        <p className="text-[11px] text-slate-400">
                          单次最多 40 页
                        </p>
                      </div>
                      {detail.status === "failed" && (
                        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-xs text-rose-700 flex gap-2">
                          <CircleAlert className="w-4 h-4 shrink-0" />
                          {describeParseError(detail.parseErrorCode)}
                        </div>
                      )}
                    </div>
                  )}
                  {inspectorTab === "structure" && (
                    <div className="space-y-1">
                      {detail.chunks
                        .filter((chunk) => chunk.level !== "document")
                        .map((chunk) => (
                          <button
                            key={chunk.id}
                            onClick={() => onOpenPage(chunk.pageStart)}
                            className={`w-full text-left rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-zinc-900 ${chunk.level === "content" ? "pl-6" : ""}`}
                          >
                            <span
                              className={`block truncate ${chunk.level === "section" ? "text-sm font-bold text-slate-700 dark:text-slate-200" : "text-xs text-slate-500"}`}
                            >
                              {chunk.title}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              第 {chunk.pageStart} 页
                            </span>
                          </button>
                        ))}
                      {!detail.chunks.length && (
                        <div className="py-16 text-center text-sm text-slate-400">
                          <Clock3 className="w-6 h-6 mx-auto mb-2" />
                          等待解析
                        </div>
                      )}
                    </div>
                  )}
                  {inspectorTab === "review" && (
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-zinc-800">
                        <button
                          onClick={() =>
                            setSelectedSuggestions(
                              selectedSuggestions.length === pending.length
                                ? []
                                : pending.map((item) => item.id),
                            )
                          }
                          className="text-xs text-slate-500 flex items-center gap-1.5"
                        >
                          <CheckCheck className="w-4 h-4" />
                          {selectedSuggestions.length === pending.length &&
                          pending.length
                            ? "取消全选"
                            : "全选"}
                        </button>
                        <div className="flex gap-1">
                          <button
                            disabled={!selectedSuggestions.length}
                            onClick={() => batchReview("ignored")}
                            className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40"
                          >
                            忽略
                          </button>
                          <button
                            disabled={!selectedSuggestions.length}
                            onClick={() => batchReview("accepted")}
                            className="btn-primary px-2.5 py-1.5 text-xs disabled:opacity-40"
                          >
                            批量同意
                          </button>
                        </div>
                      </div>
                      {pending.map((item) => (
                        <React.Fragment key={item.id}>
                          <SuggestionItem
                            item={item}
                            nodes={nodes}
                            selected={selectedSuggestions.includes(item.id)}
                            onToggle={() =>
                              setSelectedSuggestions((current) =>
                                current.includes(item.id)
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id],
                              )
                            }
                            onReview={(decision, target) =>
                              void review(item.id, decision, target)
                            }
                          />
                        </React.Fragment>
                      ))}
                      {!pending.length && (
                        <div className="py-16 text-center text-sm text-slate-400">
                          <Check className="w-7 h-7 mx-auto mb-2 text-emerald-600" />
                          暂无待审核内容
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}
      </section>
      {dialog && (
        <MetadataDialog
          resource={dialog === "edit" ? (detail ?? undefined) : undefined}
          onClose={() => setDialog(null)}
          onSaved={onDataChanged}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
