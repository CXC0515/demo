/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
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
  ResourceChunk,
  ResourceDetail,
  ResourceKind,
} from "../../domain/types";
import {
  analyzeLibraryResource,
  batchReviewSuggestions,
  deleteLibraryResource,
  ResourceMetadataInput,
  reviewSuggestion,
  retrieveLibraryResource,
  setLibraryResourcePageIncluded,
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

const compactPageRanges = (pages: number[]) => {
  if (!pages.length) return "暂无";
  const ranges: string[] = [];
  let start = pages[0];
  let end = pages[0];
  pages.slice(1).forEach((page) => {
    if (page === end + 1) end = page;
    else {
      ranges.push(start === end ? `${start}` : `${start}–${end}`);
      start = end = page;
    }
  });
  ranges.push(start === end ? `${start}` : `${start}–${end}`);
  return ranges.join("、");
};

const processingStageLabels = {
  queued: "已排队", preparing: "准备页码", ocr: "识别文字", analyzing: "分析内容",
  saving: "保存结果", completed: "已完成", failed: "失败", interrupted: "已中断",
} as const;

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

const OcrPageReader = ({
  resourceId,
  pages,
  chunks,
  selectedPage,
  onSelectPage,
}: {
  resourceId: string;
  pages: ResourceDetail["pages"];
  chunks: ResourceChunk[];
  selectedPage: number;
  onSelectPage: (page: number) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressScrollSelectionRef = useRef(false);
  const visiblePages = pages.filter((page) => page.included && page.parseStatus === "ready");
  useEffect(() => {
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-resource-page="${selectedPage}"]`);
    if (target && Math.abs(target.getBoundingClientRect().top - (scrollRef.current?.getBoundingClientRect().top ?? 0)) > 120) {
      suppressScrollSelectionRef.current = true;
      target.scrollIntoView({ block: "start" });
      const timer = window.setTimeout(() => { suppressScrollSelectionRef.current = false; }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [resourceId, selectedPage]);
  const updateCurrentPage = () => {
    if (suppressScrollSelectionRef.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top + 90;
    const candidates = Array.from(container.querySelectorAll("[data-resource-page]")) as HTMLElement[];
    let closest: HTMLElement | null = null;
    candidates.forEach((item) => {
      if (!closest || Math.abs(item.getBoundingClientRect().top - top) < Math.abs(closest.getBoundingClientRect().top - top)) closest = item;
    });
    const page = Number(closest?.dataset.resourcePage);
    if (page && page !== selectedPage) onSelectPage(page);
  };
  return (
    <div className="relative flex h-full min-h-0 flex-col bg-slate-200/50 dark:bg-zinc-950">
      <div className="z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <span className="inline-flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200"><Eye className="h-4 w-4" />OCR 第 {selectedPage} 页</span>
        <span className="text-[10px] text-slate-400">仅显示已解析且未排除的页面 · 共 {visiblePages.length} 页</span>
      </div>
      <div ref={scrollRef} onScroll={updateCurrentPage} className="min-h-0 flex-1 scroll-smooth overflow-y-auto p-3">
        <div className="mx-auto max-w-5xl space-y-4">
          {visiblePages.map((page) => {
            const pageChunks = chunks.filter((chunk) => chunk.level === "content" && chunk.pageStart <= page.pageNumber && chunk.pageEnd >= page.pageNumber);
            const imageUrl = `/api/resources/${resourceId}/pages/${page.pageNumber}/image`;
            return (
              <article key={page.pageNumber} data-resource-page={page.pageNumber} className={`scroll-mt-3 overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-zinc-900 ${page.included ? "border-slate-200 dark:border-zinc-800" : "border-dashed border-rose-300 opacity-60"}`}>
                <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-zinc-800">
                  <div className="flex items-center gap-2"><strong className="text-xs">第 {page.pageNumber} 页</strong>{!page.included && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">已排除</span>}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400"><span>{page.parseStatus === "ready" ? "已解析" : page.parseStatus === "processing" ? "解析中" : page.parseStatus === "failed" ? "解析失败" : "未解析"}</span><span>·</span><span>{page.ragStatus === "indexed" ? `RAG 已入库 ${page.ragChunkCount} 块` : page.ragStatus === "indexing" ? "RAG 入库中" : page.ragStatus === "excluded" ? "不参与 RAG" : "RAG 未入库"}</span></div>
                </header>
                <div className="p-3">
                    <figure className="mx-auto max-w-3xl">
                      <figcaption className="mb-2 text-[10px] font-black uppercase tracking-wide text-emerald-700">OCR 识别版</figcaption>
                      <div className="relative overflow-hidden rounded-lg border border-emerald-200 bg-white">
                        <img loading="lazy" src={imageUrl} alt={`第 ${page.pageNumber} 页 OCR 识别底图`} className="w-full object-contain opacity-25" style={{ aspectRatio: "210 / 297" }} />
                        {pageChunks.filter((chunk) => chunk.boundingBox).slice(0, 80).map((chunk) => (
                          <span key={chunk.id} title={chunk.text.slice(0, 180)} className="absolute overflow-hidden border border-emerald-500 bg-emerald-100/75 text-[7px] leading-tight text-emerald-950" style={{ left: `${chunk.boundingBox!.x * 100}%`, top: `${chunk.boundingBox!.y * 100}%`, width: `${chunk.boundingBox!.width * 100}%`, height: `${chunk.boundingBox!.height * 100}%` }}>{chunk.text}</span>
                        ))}
                      </div>
                      <details className="mt-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-zinc-950"><summary className="cursor-pointer font-bold text-slate-600 dark:text-slate-300">查看提取文本（{pageChunks.length} 块）</summary><div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-slate-500">{pageChunks.map((chunk) => <p key={chunk.id}>{chunk.text}</p>)}</div></details>
                    </figure>
                </div>
              </article>
            );
          })}
        </div>
      </div>
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
    "overview" | "pages" | "rag" | "review"
  >("overview");
  const [readingMode, setReadingMode] = useState<"pdf" | "ocr">("pdf");
  const [pageStart, setPageStart] = useState(1);
  const [pageEnd, setPageEnd] = useState(20);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState<Array<ResourceChunk & { retrievalRank: number }>>([]);
  const [ragSearching, setRagSearching] = useState(false);
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
  const readyPages = detail?.pages.filter((page) => page.parseStatus === "ready").map((page) => page.pageNumber) ?? [];
  const currentPageState = detail?.pages.find((page) => page.pageNumber === selectedPage);
  const latestJob = detail?.processingJobs[0];
  const pageWindowStart = Math.floor(Math.max(0, selectedPage - 1) / 50) * 50;
  const visiblePages = detail?.pages.slice(pageWindowStart, pageWindowStart + 50) ?? [];
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
    <div className="grid h-[calc(100vh-190px)] min-h-[680px] grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="glass-panel flex min-h-0 flex-col overflow-hidden rounded-2xl">
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

      <section className="glass-panel min-h-0 min-w-0 overflow-hidden rounded-2xl">
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
              <div className="flex min-h-0 flex-col bg-slate-200/50 dark:bg-zinc-950">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-zinc-800">
                    <button onClick={() => setReadingMode("pdf")} className={`rounded-md px-3 py-1.5 text-xs font-bold ${readingMode === "pdf" ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-slate-500"}`}>PDF 原文</button>
                    <button onClick={() => {
                      setReadingMode("ocr");
                      const current = detail.pages.find((page) => page.pageNumber === selectedPage);
                      if (!current?.included || current.parseStatus !== "ready") {
                        const firstReady = detail.pages.find((page) => page.included && page.parseStatus === "ready");
                        if (firstReady) onOpenPage(firstReady.pageNumber);
                      }
                    }} className={`rounded-md px-3 py-1.5 text-xs font-bold ${readingMode === "ocr" ? "bg-white text-emerald-800 shadow-sm dark:bg-zinc-700 dark:text-emerald-300" : "text-slate-500"}`}>OCR 识别</button>
                  </div>
                  <span className="text-xs font-bold text-slate-500">第 {selectedPage} 页</span>
                </div>
                <div className="min-h-0 flex-1 p-3">
                  {readingMode === "pdf" ? (
                    <object key={`${detail.id}-${selectedPage}`} data={`${detail.publicUrl}#page=${selectedPage}&view=FitH`} type="application/pdf" className="h-full min-h-[560px] w-full rounded-lg bg-white shadow-sm">
                      <a href={`${detail.publicUrl}#page=${selectedPage}`} target="_blank" rel="noreferrer" className="text-emerald-700">打开 PDF</a>
                    </object>
                  ) : (
                    <OcrPageReader resourceId={detail.id} pages={detail.pages} chunks={detail.chunks} selectedPage={selectedPage} onSelectPage={onOpenPage} />
                  )}
                </div>
              </div>
              <aside className="flex min-h-0 flex-col border-l border-slate-200/70 dark:border-zinc-800">
                <div className="grid grid-cols-4 border-b border-slate-200/70 dark:border-zinc-800">
                  {(
                    [
                      ["overview", "概览"],
                      ["pages", "页面"],
                      ["rag", "RAG"],
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
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
                        <p className="text-[11px] text-slate-500">
                          已解析：{compactPageRanges(readyPages)}
                        </p>
                        {latestJob && (
                          <div className="rounded-lg bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs text-slate-500">
                            最近任务：第 {latestJob.pageStart}–{latestJob.pageEnd} 页 · {processingStageLabels[latestJob.stage]}
                          </div>
                        )}
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
                  {inspectorTab === "pages" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <button disabled={pageWindowStart === 0} onClick={() => onOpenPage(Math.max(1, pageWindowStart - 49))} className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40">上一组</button>
                        <label className="flex flex-1 items-center gap-2 text-xs text-slate-500">跳到
                          <input type="number" min={1} max={detail.pageCount ?? 1} value={selectedPage} onChange={(event) => onOpenPage(Math.max(1, Math.min(detail.pageCount ?? 1, Number(event.target.value))))} className={`${fieldClass} min-w-0 py-1.5`} />
                        </label>
                        <button disabled={pageWindowStart + 50 >= detail.pages.length} onClick={() => onOpenPage(pageWindowStart + 51)} className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40">下一组</button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {visiblePages.map((page) => (
                          <button
                            key={page.pageNumber}
                            onClick={() => onOpenPage(page.pageNumber)}
                            className={`relative rounded-lg border px-1 py-2 text-xs font-bold ${selectedPage === page.pageNumber ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 dark:border-zinc-800 text-slate-500"} ${page.included ? "" : "opacity-45 line-through"}`}
                            title={`${page.included ? "纳入" : "已排除"} · ${page.parseStatus}`}
                          >
                            {page.pageNumber}
                            <span className={`absolute right-1 top-1 w-1.5 h-1.5 rounded-full ${page.parseStatus === "ready" ? "bg-emerald-500" : page.parseStatus === "processing" ? "bg-blue-500 animate-pulse" : page.parseStatus === "failed" ? "bg-rose-500" : "bg-slate-300"}`} />
                          </button>
                        ))}
                      </div>
                      {currentPageState && (
                        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3 space-y-3">
                          <div>
                            <p className="text-sm font-bold">第 {selectedPage} 页</p>
                            <p className="text-xs text-slate-400 mt-1">原文件保留；排除后不进入检索、RAG 与知识发现。</p>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await setLibraryResourcePageIncluded(detail.id, selectedPage, !currentPageState.included);
                                await onDataChanged(detail.id);
                                onShowToast(currentPageState.included ? "该页已从 AI 资料范围排除，可随时恢复" : "该页已恢复使用");
                              } catch (error) {
                                onShowToast(`页面更新失败：${error instanceof Error ? error.message : "未知错误"}`);
                              }
                            }}
                            className={currentPageState.included ? "btn-secondary w-full py-2 text-sm text-rose-600" : "btn-primary w-full py-2 text-sm"}
                          >
                            {currentPageState.included ? "从 AI 资料中排除此页" : "恢复此页"}
                          </button>
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400 leading-5">
                        <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />已解析　<span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />处理中　<span className="inline-block w-2 h-2 rounded-full bg-slate-300 mr-1" />未解析</p>
                        <p>上传原件保存在服务端原件目录；解析文本与引用索引保存在资料库数据库中。未来在线版可增加桌面同步目录。</p>
                      </div>
                    </div>
                  )}
                  {inspectorTab === "rag" && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">检索测试</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">直接查询已经进入 RAG 语料库的文本块，并保留原资料页码。</p>
                      </div>
                      <form onSubmit={async (event) => {
                        event.preventDefault();
                        if (!ragQuery.trim()) return;
                        setRagSearching(true);
                        try {
                          setRagResults(await retrieveLibraryResource(detail.id, ragQuery.trim()));
                        } catch (error) {
                          onShowToast(`检索失败：${error instanceof Error ? error.message : "未知错误"}`);
                        } finally {
                          setRagSearching(false);
                        }
                      }} className="space-y-2">
                        <input value={ragQuery} onChange={(event) => setRagQuery(event.target.value)} placeholder="输入知识点、题型或原文关键词" className={fieldClass} />
                        <button disabled={ragSearching || !ragQuery.trim()} className="btn-primary flex w-full items-center justify-center gap-2 py-2 text-sm disabled:opacity-40">{ragSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}检索 RAG 语料</button>
                      </form>
                      <div className="space-y-2">
                        {ragResults.map((result) => (
                          <button key={result.id} onClick={() => onOpenPage(result.pageStart)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-zinc-800 dark:hover:bg-emerald-950/20">
                            <span className="flex items-center justify-between gap-2"><strong className="truncate text-xs text-slate-700 dark:text-slate-200">{result.title}</strong><span className="shrink-0 text-[10px] font-bold text-emerald-700">第 {result.pageStart} 页</span></span>
                            <span className="mt-1.5 line-clamp-4 block text-xs leading-5 text-slate-500">{result.text}</span>
                          </button>
                        ))}
                        {!ragSearching && ragQuery && !ragResults.length && <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-xs text-slate-400">没有命中已入库内容</div>}
                      </div>
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
