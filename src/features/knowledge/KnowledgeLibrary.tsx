/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from "react";
import { Boxes, Network } from "lucide-react";
import {
  KnowledgeGraphSnapshot,
  LibraryResource,
  ResourceDetail,
} from "../../domain/types";
import {
  getKnowledgeGraph,
  getLibraryResource,
  listLibraryResources,
} from "../../services/resourceApi";
import KnowledgeGraphWorkspace from "./KnowledgeGraphWorkspace";
import ResourceLibraryEditor from "./ResourceLibraryEditor";

interface KnowledgeLibraryProps {
  mode: "graph" | "editor";
  onSwitchMode: (mode: "graph" | "editor") => void;
  onKnowledgeChanged: () => Promise<void>;
  onShowToast: (message: string) => void;
}

const emptyGraph: KnowledgeGraphSnapshot = {
  nodes: [],
  relations: [],
  sourceLinks: [],
  resources: [],
};

export default function KnowledgeLibrary({
  mode,
  onSwitchMode,
  onKnowledgeChanged,
  onShowToast,
}: KnowledgeLibraryProps) {
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [graph, setGraph] = useState<KnowledgeGraphSnapshot>(emptyGraph);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [detail, setDetail] = useState<ResourceDetail | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadResourceDetail = useCallback(async (resourceId: string) => {
    if (!resourceId) {
      setDetail(null);
      return;
    }
    const next = await getLibraryResource(resourceId);
    setDetail(next);
    setSelectedPage((current) =>
      Math.min(Math.max(current, 1), next.pageCount ?? 1),
    );
  }, []);

  const loadAll = useCallback(
    async (preferredResourceId?: string) => {
      setLoading(true);
      try {
        const [nextResources, nextGraph] = await Promise.all([
          listLibraryResources(),
          getKnowledgeGraph(),
        ]);
        setResources(nextResources);
        setGraph(nextGraph);
        const resourceId =
          preferredResourceId &&
          nextResources.some((item) => item.id === preferredResourceId)
            ? preferredResourceId
            : selectedResourceId &&
                nextResources.some((item) => item.id === selectedResourceId)
              ? selectedResourceId
              : (nextResources[0]?.id ?? "");
        setSelectedResourceId(resourceId);
        await loadResourceDetail(resourceId);
        await onKnowledgeChanged();
      } catch (error) {
        onShowToast(
          `资料库加载失败：${error instanceof Error ? error.message : "未知错误"}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [loadResourceDetail, onKnowledgeChanged, onShowToast, selectedResourceId],
  );

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (detail?.status !== "processing") return;
    const timer = window.setInterval(() => {
      void loadResourceDetail(detail.id)
        .then(() => Promise.all([listLibraryResources(), getKnowledgeGraph()]))
        .then(([nextResources, nextGraph]) => {
          setResources(nextResources);
          setGraph(nextGraph);
        })
        .catch(() => undefined);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [detail?.id, detail?.status, loadResourceDetail]);

  const selectResource = (resourceId: string) => {
    setSelectedResourceId(resourceId);
    setSelectedPage(1);
    setLoading(true);
    void loadResourceDetail(resourceId)
      .catch((error) =>
        onShowToast(
          `资料加载失败：${error instanceof Error ? error.message : "未知错误"}`,
        ),
      )
      .finally(() => setLoading(false));
  };

  const reloadGraph = async () => {
    const next = await getKnowledgeGraph();
    setGraph(next);
    await onKnowledgeChanged();
    if (detail) await loadResourceDetail(detail.id);
  };

  const openSource = (resourceId: string, pageNumber: number) => {
    setSelectedResourceId(resourceId);
    setSelectedPage(pageNumber);
    onSwitchMode("editor");
    setLoading(true);
    void loadResourceDetail(resourceId).finally(() => setLoading(false));
  };

  return (
    <div className="space-y-4 animate-fade-in" id="knowledge-library-page">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-700 uppercase">资料库</p>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 mt-1">
            {mode === "graph" ? "知识图谱" : "资料编辑"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {mode === "graph"
              ? `${graph.nodes.length} 个节点 · ${graph.relations.length} 条关系 · ${graph.sourceLinks.length} 个已确认来源`
              : `${resources.length} 份资料 · ${resources.filter((item) => item.status === "processing").length} 项正在解析`}
          </p>
        </div>
        <div className="glass-panel rounded-xl p-1 flex items-center gap-1 self-start lg:self-auto">
          <button
            onClick={() => onSwitchMode("graph")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${mode === "graph" ? "bg-emerald-700 text-white shadow-sm" : "text-slate-500 hover:bg-white/70 dark:hover:bg-zinc-800"}`}
          >
            <Network className="w-4 h-4" />
            知识图谱
          </button>
          <button
            onClick={() => onSwitchMode("editor")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${mode === "editor" ? "bg-emerald-700 text-white shadow-sm" : "text-slate-500 hover:bg-white/70 dark:hover:bg-zinc-800"}`}
          >
            <Boxes className="w-4 h-4" />
            资料编辑
          </button>
        </div>
      </div>
      {mode === "graph" ? (
        <KnowledgeGraphWorkspace
          graph={graph}
          loading={loading}
          onDataChanged={reloadGraph}
          onOpenSource={openSource}
          onShowToast={onShowToast}
        />
      ) : (
        <ResourceLibraryEditor
          resources={resources}
          detail={detail}
          nodes={graph.nodes}
          selectedPage={selectedPage}
          loading={loading}
          onSelectResource={selectResource}
          onOpenPage={setSelectedPage}
          onDataChanged={loadAll}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
