"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphNode, KnowledgeGraphData, NodeKind } from "@/lib/types";

interface Point {
  x: number;
  y: number;
}

interface KnowledgeGraphProps {
  graph: KnowledgeGraphData;
  isStreaming: boolean;
  activeAgent: string | null;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode | null) => void;
}

const KIND_STYLES: Record<
  NodeKind,
  { fill: string; stroke: string; badge: string; label: string }
> = {
  query: {
    fill: "rgba(14, 165, 233, 0.16)",
    stroke: "#38bdf8",
    badge: "bg-sky-500/20 text-sky-300 border-sky-400/30",
    label: "Objective",
  },
  agent: {
    fill: "rgba(139, 92, 246, 0.18)",
    stroke: "#a78bfa",
    badge: "bg-violet-500/20 text-violet-300 border-violet-400/30",
    label: "Agent",
  },
  evidence: {
    fill: "rgba(16, 185, 129, 0.16)",
    stroke: "#34d399",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    label: "Evidence",
  },
  synthesis: {
    fill: "rgba(245, 158, 11, 0.18)",
    stroke: "#fbbf24",
    badge: "bg-amber-500/20 text-amber-300 border-amber-400/30",
    label: "Synthesis",
  },
};

function computeInitialPositions(nodes: GraphNode[]): Record<string, Point> {
  const positions: Record<string, Point> = {};
  const evidenceNodes = nodes.filter((n) => n.kind === "evidence");

  const fixedCoords: Record<string, Point> = {
    "query:root": { x: 460, y: 72 },
    "agent:strategist": { x: 240, y: 195 },
    "agent:researcher": { x: 460, y: 195 },
    "agent:writer": { x: 460, y: 405 },
    "synthesis:blueprint": { x: 685, y: 405 },
    "agent:checker": { x: 685, y: 195 },
  };

  for (const node of nodes) {
    if (fixedCoords[node.id]) {
      positions[node.id] = fixedCoords[node.id];
    }
  }

  const count = evidenceNodes.length;
  evidenceNodes.forEach((node, idx) => {
    const spread = Math.min(720, Math.max(220, count * 175));
    const startX = 460 - spread / 2 + (count === 1 ? spread / 2 : 0);
    const stepX = count > 1 ? spread / (count - 1) : 0;
    positions[node.id] = {
      x: startX + idx * stepX,
      y: 300 + (idx % 2 === 0 ? -12 : 16),
    };
  });

  // Fallback for any unexpected custom node IDs
  nodes.forEach((node, idx) => {
    if (!positions[node.id]) {
      positions[node.id] = { x: 180 + (idx % 4) * 180, y: 480 };
    }
  });

  return positions;
}

export function KnowledgeGraph({
  graph,
  isStreaming,
  activeAgent,
  selectedNodeId,
  onSelectNode,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [positions, setPositions] = useState<Record<string, Point>>(() =>
    computeInitialPositions(graph.nodes)
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<
    | { mode: "node"; nodeId: string; startX: number; startY: number; orig: Point }
    | { mode: "pan"; startX: number; startY: number; origPan: Point }
    | null
  >(null);

  useEffect(() => {
    setPositions(computeInitialPositions(graph.nodes));
  }, [graph]);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId]
  );

  const selectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return graph.edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );
  }, [graph.edges, selectedNode]);

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragState) return;
    const dx = (e.clientX - dragState.startX) / zoom;
    const dy = (e.clientY - dragState.startY) / zoom;

    if (dragState.mode === "node") {
      setPositions((prev) => ({
        ...prev,
        [dragState.nodeId]: {
          x: dragState.orig.x + dx,
          y: dragState.orig.y + dy,
        },
      }));
    } else {
      setPan({
        x: dragState.origPan.x + (e.clientX - dragState.startX),
        y: dragState.origPan.y + (e.clientY - dragState.startY),
      });
    }
  }

  function handleResetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPositions(computeInitialPositions(graph.nodes));
  }

  return (
    <div className="relative flex h-full min-h-[540px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080d18]/90 shadow-2xl">
      {/* Canvas Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_10px_#a78bfa]" />
          <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Source Mind-Map
          </h2>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {(["query", "agent", "evidence", "synthesis"] as NodeKind[]).map(
            (kind) => (
              <span
                key={kind}
                className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase sm:inline-flex ${KIND_STYLES[kind].badge}`}
              >
                {KIND_STYLES[kind].label}
              </span>
            )
          )}
          <div className="ml-2 flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.15).toFixed(2))))}
              className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-white/10"
              title="Zoom out"
            >
              −
            </button>
            <span className="min-w-[42px] text-center text-[11px] text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.85, Number((z + 0.15).toFixed(2))))}
              className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-white/10"
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="rounded px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/10"
              title="Reset layout"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative flex-1 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.09),transparent_55%)]">
        <svg
          ref={svgRef}
          viewBox="0 0 920 500"
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={(e) => {
            if (e.target === svgRef.current) {
              setDragState({
                mode: "pan",
                startX: e.clientX,
                startY: e.clientY,
                origPan: pan,
              });
              onSelectNode(null);
            }
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDragState(null)}
          onPointerLeave={() => setDragState(null)}
        >
          <defs>
            <pattern
              id="aether-grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="rgba(255,255,255,0.035)"
                strokeWidth="1"
              />
            </pattern>
            <marker
              id="aether-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(148,163,184,0.65)" />
            </marker>
          </defs>

          <rect width="100%" height="100%" fill="url(#aether-grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {graph.edges.map((edge, idx) => {
              const from = positions[edge.source];
              const to = positions[edge.target];
              if (!from || !to) return null;

              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              const isRelated =
                selectedNodeId === edge.source || selectedNodeId === edge.target;

              return (
                <g key={`${edge.source}-${edge.target}-${idx}`}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={
                      isRelated
                        ? "rgba(167, 139, 250, 0.85)"
                        : "rgba(148, 163, 184, 0.3)"
                    }
                    strokeWidth={isRelated ? 2.2 : 1.4}
                    strokeDasharray={isStreaming ? "6 4" : undefined}
                    markerEnd="url(#aether-arrow)"
                  />
                  <rect
                    x={midX - 42}
                    y={midY - 9}
                    width={84}
                    height={16}
                    rx={8}
                    fill="rgba(6, 9, 15, 0.85)"
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <text
                    x={midX}
                    y={midY + 2.5}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9px] font-medium select-none"
                  >
                    {edge.relation.length > 14
                      ? `${edge.relation.slice(0, 14)}…`
                      : edge.relation}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {graph.nodes.map((node) => {
              const pos = positions[node.id];
              if (!pos) return null;
              const style = KIND_STYLES[node.kind] ?? KIND_STYLES.evidence;
              const isSelected = selectedNodeId === node.id;
              const isActiveAgent =
                node.kind === "agent" &&
                activeAgent &&
                node.label.toLowerCase() === activeAgent.toLowerCase();

              const width = node.kind === "agent" ? 132 : 178;
              const height = 52;
              const shortLabel =
                node.label.length > 22
                  ? `${node.label.slice(0, 22)}…`
                  : node.label;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x - width / 2}, ${pos.y - height / 2})`}
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectNode(node);
                    setDragState({
                      mode: "node",
                      nodeId: node.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      orig: pos,
                    });
                  }}
                >
                  {(isSelected || isActiveAgent) && (
                    <rect
                      x={-4}
                      y={-4}
                      width={width + 8}
                      height={height + 8}
                      rx={16}
                      fill="none"
                      stroke={style.stroke}
                      strokeOpacity={0.55}
                      strokeWidth={2}
                    />
                  )}
                  <rect
                    width={width}
                    height={height}
                    rx={13}
                    fill="#0b1220"
                    stroke={style.stroke}
                    strokeOpacity={isSelected ? 1 : 0.55}
                    strokeWidth={isSelected ? 2 : 1.3}
                  />
                  <rect
                    width={width}
                    height={height}
                    rx={13}
                    fill={style.fill}
                  />
                  <text
                    x={12}
                    y={19}
                    className="fill-slate-400 text-[9px] font-semibold uppercase tracking-wider select-none"
                  >
                    {style.label}
                    {node.score ? ` · ${Math.round(node.score * 100)}%` : ""}
                  </text>
                  <text
                    x={12}
                    y={36}
                    className="fill-slate-100 text-[11.5px] font-semibold select-none"
                  >
                    {shortLabel}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Node Inspector Drawer */}
        {selectedNode && (
          <div className="absolute right-4 bottom-4 left-4 rounded-xl border border-white/15 bg-slate-950/92 p-4 backdrop-blur-xl sm:left-auto sm:w-88">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    KIND_STYLES[selectedNode.kind].badge
                  }`}
                >
                  {KIND_STYLES[selectedNode.kind].label}
                </span>
                <h3 className="mt-1.5 text-sm font-semibold text-white">
                  {selectedNode.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectNode(null)}
                className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {selectedNode.summary}
            </p>
            {selectedNode.tags && selectedNode.tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {selectedNode.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 border-t border-white/10 pt-2 text-[11px] text-slate-400">
              Connected edges: {selectedEdges.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
