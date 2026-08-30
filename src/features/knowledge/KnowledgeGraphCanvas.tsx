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
import { ChevronDown, ChevronRight, Focus, Maximize2 } from "lucide-react";
import {
  KnowledgeEntity,
  KnowledgeEntityType,
  KnowledgeRelation,
  KnowledgeRelationType,
} from "../../domain/types";
import {
  entityLabels,
  relationLabels,
} from "./knowledgeUi";

const NODE_WIDTH = 196;
const NODE_HEIGHT = 74;

const nodePalette: Record<KnowledgeEntityType, { accent: string; fill: string; text: string }> = {
  knowledge: { accent: "#047857", fill: "#ecfdf5", text: "#065f46" },
  "question-type": { accent: "#2563eb", fill: "#eff6ff", text: "#1d4ed8" },
  method: { accent: "#7c3aed", fill: "#f5f3ff", text: "#6d28d9" },
  example: { accent: "#c2410c", fill: "#fff7ed", text: "#9a3412" },
  ability: { accent: "#0f766e", fill: "#f0fdfa", text: "#115e59" },
  error: { accent: "#be123c", fill: "#fff1f2", text: "#9f1239" },
};

const relationPalette: Record<KnowledgeRelationType, string> = {
  parent: "#64748b",
  prerequisite: "#059669",
  related: "#0284c7",
  confusable: "#e11d48",
  examines: "#7c3aed",
  "applies-to": "#c2410c",
  demonstrates: "#ca8a04",
  explains: "#0f766e",
};

type GraphNodeData = {
  entity: KnowledgeEntity;
  selected: boolean;
  collapsed: boolean;
  expandable: boolean;
  onToggle: (nodeId: string) => void;
};

type GraphNode = Node<GraphNodeData, "knowledge">;

const KnowledgeNode = memo(({ data }: NodeProps<GraphNode>) => {
  const palette = nodePalette[data.entity.type];
  return (
    <div
      className={`relative h-[74px] w-[196px] rounded-lg border bg-white shadow-sm transition-shadow dark:bg-zinc-900 ${data.selected ? "ring-2 ring-emerald-600 ring-offset-2 dark:ring-offset-zinc-950" : "hover:shadow-md"}`}
      style={{ borderColor: data.selected ? palette.accent : "#cbd5e1" }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-white !bg-slate-400" />
      <div className="flex h-full min-w-0 items-center gap-3 px-3.5">
        <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: palette.accent }} />
        <div className="min-w-0 flex-1">
          <span
            className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-black"
            style={{ background: palette.fill, color: palette.text }}
          >
            {entityLabels[data.entity.type]}
          </span>
          <p className="mt-1.5 truncate text-[13px] font-black text-slate-800 dark:text-zinc-100">
            {data.entity.name}
          </p>
        </div>
        {data.expandable ? (
          <button
            type="button"
            title={data.collapsed ? "展开关联节点" : "收起关联节点"}
            aria-label={data.collapsed ? "展开关联节点" : "收起关联节点"}
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

KnowledgeNode.displayName = "KnowledgeNode";

const nodeTypes = { knowledge: KnowledgeNode };

const findVisibleNodeIds = (
  nodes: KnowledgeEntity[],
  relations: KnowledgeRelation[],
  selectedId: string,
  depth: number | "all",
  collapsedIds: Set<string>,
) => {
  if (depth === "all" || !selectedId) return new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach((node) => adjacency.set(node.id, new Set()));
  relations.forEach((relation) => {
    adjacency.get(relation.sourceNodeId)?.add(relation.targetNodeId);
    adjacency.get(relation.targetNodeId)?.add(relation.sourceNodeId);
  });
  const visible = new Set([selectedId]);
  let frontier = [selectedId];
  for (let level = 0; level < depth; level += 1) {
    const next: string[] = [];
    frontier.forEach((nodeId) => {
      if (collapsedIds.has(nodeId)) return;
      adjacency.get(nodeId)?.forEach((neighborId) => {
        if (!visible.has(neighborId)) {
          visible.add(neighborId);
          next.push(neighborId);
        }
      });
    });
    frontier = next;
  }
  return visible;
};

const layoutGraph = (nodes: GraphNode[], edges: Edge[]) => {
  const layout = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  layout.setGraph({ rankdir: "LR", ranksep: 92, nodesep: 34, marginx: 36, marginy: 36 });
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
  nodes: KnowledgeEntity[];
  relations: KnowledgeRelation[];
  selectedId: string;
  onSelect: (nodeId: string) => void;
}

const KnowledgeGraphCanvasInner = ({ nodes, relations, selectedId, onSelect }: CanvasProps) => {
  const { fitView, setCenter } = useReactFlow<GraphNode, Edge>();
  const [depth, setDepth] = useState<1 | 2 | 3 | "all">(2);
  const [relationTypes, setRelationTypes] = useState<Set<KnowledgeRelationType>>(
    () => new Set(Object.keys(relationLabels) as KnowledgeRelationType[]),
  );
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const lastSelectedId = useRef(selectedId);

  const activeRelations = useMemo(
    () => relations.filter((relation) => relationTypes.has(relation.type)),
    [relations, relationTypes],
  );
  const visibleNodeIds = useMemo(
    () => findVisibleNodeIds(nodes, activeRelations, selectedId, depth, collapsedIds),
    [nodes, activeRelations, selectedId, depth, collapsedIds],
  );
  const connectedIds = useMemo(() => {
    const result = new Set<string>();
    activeRelations.forEach((relation) => {
      result.add(relation.sourceNodeId);
      result.add(relation.targetNodeId);
    });
    return result;
  }, [activeRelations]);

  const toggleCollapsed = useCallback((nodeId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const flowEdges = useMemo<Edge[]>(
    () =>
      activeRelations
        .filter(
          (relation) =>
            visibleNodeIds.has(relation.sourceNodeId) && visibleNodeIds.has(relation.targetNodeId),
        )
        .map((relation) => ({
          id: relation.id,
          source: relation.type === "parent" ? relation.targetNodeId : relation.sourceNodeId,
          target: relation.type === "parent" ? relation.sourceNodeId : relation.targetNodeId,
          type: "smoothstep",
          label: relationLabels[relation.type],
          labelStyle: { fill: relationPalette[relation.type], fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
          labelBgPadding: [5, 3],
          labelBgBorderRadius: 4,
          markerEnd: { type: MarkerType.ArrowClosed, color: relationPalette[relation.type], width: 14, height: 14 },
          style: { stroke: relationPalette[relation.type], strokeWidth: 1.5 },
        })),
    [activeRelations, visibleNodeIds],
  );

  const flowNodes = useMemo(() => {
    const projected: GraphNode[] = nodes
      .filter((node) => visibleNodeIds.has(node.id))
      .map((entity) => ({
        id: entity.id,
        type: "knowledge",
        position: { x: 0, y: 0 },
        data: {
          entity,
          selected: entity.id === selectedId,
          collapsed: collapsedIds.has(entity.id),
          expandable: depth !== "all" && connectedIds.has(entity.id),
          onToggle: toggleCollapsed,
        },
      }));
    return layoutGraph(projected, flowEdges);
  }, [nodes, visibleNodeIds, selectedId, collapsedIds, connectedIds, toggleCollapsed, flowEdges, depth]);
  const [renderNodes, setRenderNodes, onNodesChange] = useNodesState<GraphNode>(flowNodes);

  useEffect(() => {
    setRenderNodes(flowNodes);
  }, [flowNodes, setRenderNodes]);

  useEffect(() => {
    const timer = window.setTimeout(() => fitView({ padding: 0.18, duration: 320, maxZoom: 1.15 }), 30);
    return () => window.clearTimeout(timer);
  }, [depth, relationTypes, collapsedIds, fitView]);

  useEffect(() => {
    if (lastSelectedId.current === selectedId) return;
    lastSelectedId.current = selectedId;
    const selectedNode = renderNodes.find((node) => node.id === selectedId);
    if (!selectedNode) return;
    setCenter(selectedNode.position.x + NODE_WIDTH / 2, selectedNode.position.y + NODE_HEIGHT / 2, {
      zoom: 1,
      duration: 300,
    });
  }, [selectedId, renderNodes, setCenter]);

  const toggleRelationType = (relationType: KnowledgeRelationType) => {
    setRelationTypes((current) => {
      const next = new Set(current);
      if (next.has(relationType)) next.delete(relationType);
      else next.add(relationType);
      return next;
    });
  };

  return (
    <div className="relative h-full min-h-[560px] bg-slate-50/70 dark:bg-zinc-950/40">
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex rounded-md bg-slate-100 p-0.5 dark:bg-zinc-800" aria-label="图谱范围">
          {([1, 2, 3, "all"] as const).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setDepth(value)}
              className={`h-7 min-w-8 rounded px-2 text-[11px] font-bold ${depth === value ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-700 dark:text-emerald-300" : "text-slate-500"}`}
              title={value === "all" ? "显示全部节点" : `显示 ${value} 层关联`}
            >
              {value === "all" ? "全部" : `${value}层`}
            </button>
          ))}
        </div>
        <span className="h-5 w-px bg-slate-200 dark:bg-zinc-700" />
        <div className="flex max-w-full gap-1 overflow-x-auto" aria-label="关系筛选">
          {(Object.keys(relationLabels) as KnowledgeRelationType[]).map((relationType) => (
            <button
              type="button"
              key={relationType}
              onClick={() => toggleRelationType(relationType)}
              aria-pressed={relationTypes.has(relationType)}
              className={`h-7 whitespace-nowrap rounded-md border px-2 text-[10px] font-bold ${relationTypes.has(relationType) ? "border-slate-300 bg-white text-slate-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" : "border-transparent bg-slate-100 text-slate-400 opacity-60 dark:bg-zinc-800"}`}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: relationPalette[relationType] }} />
              {relationLabels[relationType]}
            </button>
          ))}
        </div>
      </div>
      <ReactFlow<GraphNode, Edge>
        nodes={renderNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => onSelect(node.id)}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.2}
        maxZoom={2.2}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.15 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={24} size={1} />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(node) => nodePalette[(node.data as GraphNodeData).entity.type].accent}
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
              if (selectedNode) setCenter(selectedNode.position.x + NODE_WIDTH / 2, selectedNode.position.y + NODE_HEIGHT / 2, { zoom: 1, duration: 300 });
            }}
            className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <Focus className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="适应全部节点"
            aria-label="适应全部节点"
            onClick={() => fitView({ padding: 0.18, duration: 300, maxZoom: 1.15 })}
            className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </ReactFlow>
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-400 shadow-sm dark:bg-zinc-900/90">
        {renderNodes.length} / {nodes.length} 个节点
      </div>
    </div>
  );
};

export default function KnowledgeGraphCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
