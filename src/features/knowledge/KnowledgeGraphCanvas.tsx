import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ChevronDown,
  ChevronRight,
  Focus,
  Maximize2,
  Network,
  Rows3,
} from "lucide-react";
import { KnowledgeEntity } from "../../domain/types";
import { entityLabels } from "./knowledgeUi";

const NODE_WIDTH = 210;
const NODE_HEIGHT = 76;

const nodePalette: Record<"domain" | "topic" | "knowledge", { accent: string; fill: string; text: string }> = {
  domain: { accent: "#334155", fill: "#f1f5f9", text: "#1e293b" },
  topic: { accent: "#0f766e", fill: "#f0fdfa", text: "#115e59" },
  knowledge: { accent: "#15803d", fill: "#f0fdf4", text: "#166534" },
};

type TreeEntity = KnowledgeEntity & { type: "domain" | "topic" | "knowledge" };

type TreeNodeData = {
  entity: TreeEntity;
  selected: boolean;
  collapsed: boolean;
  childCount: number;
  onToggle: (nodeId: string) => void;
};

type TreeNode = Node<TreeNodeData, "tree-node">;

const KnowledgeTreeNode = memo(({ data }: NodeProps<TreeNode>) => {
  const palette = nodePalette[data.entity.type];
  return (
    <div
      className={`relative h-[76px] w-[210px] rounded-lg border bg-white shadow-sm transition-shadow dark:bg-zinc-900 ${data.selected ? "ring-2 ring-emerald-600 ring-offset-2 dark:ring-offset-zinc-950" : "hover:shadow-md"}`}
      style={{ borderColor: data.selected ? palette.accent : "#cbd5e1" }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-white !bg-slate-400" />
      <div className="flex h-full min-w-0 items-center gap-3 px-3.5">
        <span className="h-11 w-1 shrink-0 rounded-full" style={{ background: palette.accent }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-black"
              style={{ background: palette.fill, color: palette.text }}
            >
              {entityLabels[data.entity.type]}
            </span>
            {data.entity.trainable ? <span className="text-[9px] font-bold text-slate-400">可训练</span> : null}
          </div>
          <p className="mt-1.5 truncate text-[13px] font-black text-slate-800 dark:text-zinc-100">
            {data.entity.name}
          </p>
        </div>
        {data.childCount ? (
          <button
            type="button"
            title={data.collapsed ? `展开 ${data.childCount} 个子节点` : "收起子节点"}
            aria-label={data.collapsed ? `展开“${data.entity.name}”` : `收起“${data.entity.name}”`}
            onClick={(event) => {
              event.stopPropagation();
              data.onToggle(data.entity.id);
            }}
            className="nodrag nopan grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-emerald-700 dark:hover:bg-zinc-800"
          >
            {data.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-white !bg-slate-400" />
    </div>
  );
});

KnowledgeTreeNode.displayName = "KnowledgeTreeNode";
const nodeTypes = { "tree-node": KnowledgeTreeNode };

const layoutTree = (nodes: TreeNode[], edges: Edge[]) => {
  const layout = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  layout.setGraph({ rankdir: "LR", ranksep: 92, nodesep: 30, marginx: 42, marginy: 42 });
  nodes.forEach((node) => layout.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((edge) => layout.setEdge(edge.source, edge.target));
  dagre.layout(layout);
  return nodes.map((node) => {
    const position = layout.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });
};

interface CanvasProps {
  subject: string;
  nodes: KnowledgeEntity[];
  selectedId: string;
  onSelect: (nodeId: string) => void;
}

const KnowledgeTreeCanvasInner = ({ subject, nodes, selectedId, onSelect }: CanvasProps) => {
  const { fitView, setCenter } = useReactFlow<TreeNode, Edge>();
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const lastSelectedId = useRef(selectedId);
  const structuralNodes = useMemo(
    () =>
      nodes.filter(
        (node): node is TreeEntity =>
          node.type === "domain" || node.type === "topic" || node.type === "knowledge",
      ),
    [nodes],
  );
  const nodeById = useMemo(
    () => new Map(structuralNodes.map((node) => [node.id, node])),
    [structuralNodes],
  );
  const childrenByMother = useMemo(() => {
    const children = new Map<string, TreeEntity[]>();
    structuralNodes.forEach((node) => {
      if (!node.primaryMotherId || !nodeById.has(node.primaryMotherId)) return;
      const siblings = children.get(node.primaryMotherId) ?? [];
      siblings.push(node);
      children.set(node.primaryMotherId, siblings);
    });
    children.forEach((siblings) =>
      siblings.sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name)),
    );
    return children;
  }, [structuralNodes, nodeById]);

  const visibleIds = useMemo(() => {
    const visible = new Set<string>();
    const visit = (node: TreeEntity) => {
      visible.add(node.id);
      if (collapsedIds.has(node.id)) return;
      childrenByMother.get(node.id)?.forEach(visit);
    };
    structuralNodes
      .filter((node) => !node.primaryMotherId || !nodeById.has(node.primaryMotherId))
      .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name))
      .forEach(visit);
    return visible;
  }, [structuralNodes, nodeById, childrenByMother, collapsedIds]);

  const toggleCollapsed = useCallback((nodeId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setCollapsedIds((current) => {
      const next = new Set(current);
      let cursor = nodeById.get(selectedId);
      let changed = false;
      while (cursor?.primaryMotherId) {
        if (next.delete(cursor.primaryMotherId)) changed = true;
        cursor = nodeById.get(cursor.primaryMotherId);
      }
      return changed ? next : current;
    });
  }, [selectedId, nodeById]);

  const edges = useMemo<Edge[]>(
    () =>
      structuralNodes
        .filter(
          (node) =>
            node.primaryMotherId &&
            visibleIds.has(node.id) &&
            visibleIds.has(node.primaryMotherId),
        )
        .map((node) => ({
          id: `mother:${node.primaryMotherId}:${node.id}`,
          source: node.primaryMotherId!,
          target: node.id,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 13, height: 13 },
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        })),
    [structuralNodes, visibleIds],
  );

  const projectedNodes = useMemo(() => {
    const projected: TreeNode[] = structuralNodes
      .filter((node) => visibleIds.has(node.id))
      .map((entity) => ({
        id: entity.id,
        type: "tree-node",
        position: { x: 0, y: 0 },
        data: {
          entity,
          selected: entity.id === selectedId,
          collapsed: collapsedIds.has(entity.id),
          childCount: childrenByMother.get(entity.id)?.length ?? 0,
          onToggle: toggleCollapsed,
        },
      }));
    return layoutTree(projected, edges);
  }, [structuralNodes, visibleIds, selectedId, collapsedIds, childrenByMother, toggleCollapsed, edges]);
  const [renderNodes, setRenderNodes, onNodesChange] = useNodesState<TreeNode>(projectedNodes);

  useEffect(() => setRenderNodes(projectedNodes), [projectedNodes, setRenderNodes]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => fitView({ padding: 0.16, duration: 300, maxZoom: 1.05 }),
      30,
    );
    return () => window.clearTimeout(timer);
  }, [visibleIds, fitView]);

  useEffect(() => {
    if (!selectedId || lastSelectedId.current === selectedId) return;
    lastSelectedId.current = selectedId;
    const selectedNode = renderNodes.find((node) => node.id === selectedId);
    if (!selectedNode) return;
    setCenter(selectedNode.position.x + NODE_WIDTH / 2, selectedNode.position.y + NODE_HEIGHT / 2, {
      zoom: 1,
      duration: 280,
    });
  }, [selectedId, renderNodes, setCenter]);

  return (
    <div className="relative h-[590px] bg-slate-50/70 dark:bg-zinc-950/40">
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex min-w-0 items-center gap-2 pr-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-emerald-700 text-white">
            <Network className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black text-slate-700 dark:text-zinc-100">{subject}知识主干</p>
            <p className="whitespace-nowrap text-[9px] text-slate-400">仅显示母子结构</p>
          </div>
        </div>
        <span className="h-6 w-px shrink-0 bg-slate-200 dark:bg-zinc-700" />
        <button
          type="button"
          onClick={() => setCollapsedIds(new Set(structuralNodes.filter((node) => node.type === "domain").map((node) => node.id)))}
          className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
        >
          <Rows3 className="h-3.5 w-3.5" />
          收起到板块
        </button>
        <button
          type="button"
          onClick={() => setCollapsedIds(new Set())}
          className="h-7 shrink-0 rounded-md px-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
        >
          展开全部
        </button>
      </div>
      <ReactFlow<TreeNode, Edge>
        className="h-full"
        nodes={renderNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => onSelect(node.id)}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.2}
        maxZoom={2.2}
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1.05 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={24} size={1} />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(node) => nodePalette[(node.data as TreeNodeData).entity.type].accent}
          maskColor="rgba(241, 245, 249, 0.72)"
          className="!border !border-slate-200 !bg-white dark:!border-zinc-700 dark:!bg-zinc-900"
        />
        <Controls position="bottom-left" showInteractive={false} />
        <div className="absolute bottom-3 left-14 z-10 flex gap-1">
          <button
            type="button"
            title="定位当前节点"
            aria-label="定位当前节点"
            onClick={() => {
              const selectedNode = renderNodes.find((node) => node.id === selectedId);
              if (selectedNode) setCenter(selectedNode.position.x + NODE_WIDTH / 2, selectedNode.position.y + NODE_HEIGHT / 2, { zoom: 1, duration: 280 });
            }}
            className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <Focus className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="适应全部节点"
            aria-label="适应全部节点"
            onClick={() => fitView({ padding: 0.16, duration: 280, maxZoom: 1.05 })}
            className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </ReactFlow>
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-400 shadow-sm dark:bg-zinc-900/90">
        {renderNodes.length} / {structuralNodes.length} 个主干节点
      </div>
    </div>
  );
};

export default function KnowledgeGraphCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeTreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
