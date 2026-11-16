"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentTracePanel } from "@/components/AgentTracePanel";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { KnowledgeSidebar } from "@/components/KnowledgeSidebar";
import {
  STARTER_DOCS,
  runLocalOrchestrator,
  searchLocalDocs,
} from "@/lib/localEngine";
import type {
  AgentStep,
  GraphNode,
  RunResult,
  SearchResult,
  WorkspaceDoc,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  API_URL.replace(/^http/, "ws") + "/ws/workspace";

const PRESET_OBJECTIVES = [
  "Design a hybrid vector search + multi-agent reasoning graph",
  "Optimize WebSocket streaming backpressure and latency",
  "Architect distributed CRDT collaborative graph canvas",
];

const INITIAL_RUN = runLocalOrchestrator(STARTER_DOCS, PRESET_OBJECTIVES[0], 4);

function makeQueuedSteps(): AgentStep[] {
  return [
    {
      agent: "Planner",
      role: "Task Decomposition",
      status: "running",
      latency_ms: 0,
      output: "Decomposing objective into retrieval & synthesis tracks...",
      highlights: [],
    },
    {
      agent: "Researcher",
      role: "Hybrid Vector Retrieval",
      status: "waiting",
      latency_ms: 0,
      output: "",
      highlights: [],
    },
    {
      agent: "Synthesizer",
      role: "Knowledge Graph Builder",
      status: "waiting",
      latency_ms: 0,
      output: "",
      highlights: [],
    },
    {
      agent: "Critic",
      role: "Verification & Risk Audit",
      status: "waiting",
      latency_ms: 0,
      output: "",
      highlights: [],
    },
  ];
}

export default function WorkspacePage() {
  const [objective, setObjective] = useState(PRESET_OBJECTIVES[0]);
  const [docs, setDocs] = useState<WorkspaceDoc[]>(STARTER_DOCS);
  const [runs, setRuns] = useState<RunResult[]>([INITIAL_RUN]);
  const [activeRun, setActiveRun] = useState<RunResult>(INITIAL_RUN);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteSearchResults, setRemoteSearchResults] = useState<SearchResult[] | null>(
    null
  );
  const [backendOnline, setBackendOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [transportMode, setTransportMode] = useState<"websocket" | "rest" | "local">(
    "local"
  );

  const wsRef = useRef<WebSocket | null>(null);

  const hydrateFromBackend = useCallback(async () => {
    try {
      const healthRes = await fetch(`${API_URL}/health`);
      if (!healthRes.ok) throw new Error("API offline");
      setBackendOnline(true);

      const [docsRes, runsRes] = await Promise.all([
        fetch(`${API_URL}/api/documents`),
        fetch(`${API_URL}/api/runs`),
      ]);

      if (docsRes.ok) {
        const docsJson = await docsRes.json();
        if (Array.isArray(docsJson.documents) && docsJson.documents.length > 0) {
          setDocs(docsJson.documents);
        }
      }

      if (runsRes.ok) {
        const runsJson = await runsRes.json();
        if (Array.isArray(runsJson.runs) && runsJson.runs.length > 0) {
          setRuns(runsJson.runs);
          setActiveRun(runsJson.runs[0]);
        }
      }
      setTransportMode("rest");
    } catch {
      setBackendOnline(false);
      setTransportMode("local");
    }
  }, []);

  useEffect(() => {
    hydrateFromBackend();
  }, [hydrateFromBackend]);

  useEffect(() => {
    if (!backendOnline) return;

    let cancelled = false;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!cancelled) {
        setWsConnected(true);
        setTransportMode("websocket");
      }
    };

    ws.onmessage = (event) => {
      if (cancelled) return;
      const msg = JSON.parse(event.data);

      if (msg.type === "run_started") {
        setIsStreaming(true);
        setActiveRun((prev) => ({
          ...prev,
          run_id: msg.run_id,
          objective: msg.objective,
          steps: makeQueuedSteps(),
        }));
      } else if (msg.type === "agent_step") {
        const incoming: AgentStep = msg.step;
        setActiveRun((prev) => {
          const updated = prev.steps.map((s) =>
            s.agent === incoming.agent ? incoming : s
          );
          const nextIdx =
            updated.findIndex((s) => s.agent === incoming.agent) + 1;
          if (nextIdx < updated.length && updated[nextIdx].status === "waiting") {
            updated[nextIdx] = { ...updated[nextIdx], status: "running" };
          }
          return { ...prev, steps: updated };
        });
      } else if (msg.type === "run_completed") {
        const completed: RunResult = msg.result;
        setActiveRun(completed);
        setRuns((prev) => [
          completed,
          ...prev.filter((r) => r.run_id !== completed.run_id),
        ]);
        setIsStreaming(false);
      }
    };

    ws.onclose = () => {
      if (!cancelled) {
        setWsConnected(false);
        setIsStreaming(false);
      }
    };

    ws.onerror = () => {
      if (!cancelled) {
        setWsConnected(false);
      }
    };

    return () => {
      cancelled = true;
      ws.close();
      wsRef.current = null;
    };
  }, [backendOnline]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !backendOnline) {
      setRemoteSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/search?q=${encodeURIComponent(q)}&top_k=5`
        );
        if (res.ok) {
          const data = await res.json();
          setRemoteSearchResults(data.results);
        }
      } catch {
        setRemoteSearchResults(null);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, backendOnline]);

  const effectiveSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    if (remoteSearchResults !== null) return remoteSearchResults;
    return searchLocalDocs(docs, searchQuery, 5);
  }, [docs, searchQuery, remoteSearchResults]);

  const activeAgent = useMemo(
    () => activeRun.steps.find((s) => s.status === "running")?.agent ?? null,
    [activeRun.steps]
  );

  async function handleRunObjective(customObjective?: string) {
    const target = (customObjective ?? objective).trim();
    if (target.length < 2 || isStreaming) return;
    setSelectedNodeId(null);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsStreaming(true);
      setTransportMode("websocket");
      wsRef.current.send(JSON.stringify({ objective: target, top_k: 4 }));
      return;
    }

    if (backendOnline) {
      setIsStreaming(true);
      setTransportMode("rest");
      try {
        const res = await fetch(`${API_URL}/api/agents/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective: target, top_k: 4 }),
        });
        if (res.ok) {
          const data: RunResult = await res.json();
          setActiveRun(data);
          setRuns((prev) => [data, ...prev]);
          setIsStreaming(false);
          return;
        }
      } catch {
        setBackendOnline(false);
      }
    }

    // Smooth deterministic local engine streaming fallback
    setTransportMode("local");
    setIsStreaming(true);
    const localResult = runLocalOrchestrator(docs, target, 4);
    const staged = makeQueuedSteps();
    setActiveRun({ ...localResult, steps: staged });

    for (let i = 0; i < localResult.steps.length; i++) {
      await new Promise((r) => setTimeout(r, 150));
      setActiveRun((prev) => {
        const nextSteps = prev.steps.map((s, idx) => {
          if (idx === i) return localResult.steps[i];
          if (idx === i + 1) return { ...s, status: "running" as const };
          return s;
        });
        return { ...prev, steps: nextSteps };
      });
    }

    setActiveRun(localResult);
    setRuns((prev) => [localResult, ...prev]);
    setIsStreaming(false);
  }

  async function handleAddDoc(input: {
    title: string;
    content: string;
    tags: string[];
    category: string;
  }) {
    const slug =
      input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) || "node";
    const doc_id = `${slug}-${Date.now().toString(36).slice(-4)}`;

    if (backendOnline) {
      try {
        const res = await fetch(`${API_URL}/api/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc_id, ...input }),
        });
        if (res.ok) {
          const created: WorkspaceDoc = await res.json();
          setDocs((prev) => [created, ...prev]);
          return;
        }
      } catch {
        setBackendOnline(false);
      }
    }

    setDocs((prev) => [
      { doc_id, ...input, created_at: new Date().toISOString() },
      ...prev,
    ]);
  }

  async function handleDeleteDoc(docId: string) {
    if (backendOnline) {
      try {
        await fetch(`${API_URL}/api/documents/${encodeURIComponent(docId)}`, {
          method: "DELETE",
        });
      } catch {
        setBackendOnline(false);
      }
    }
    setDocs((prev) => prev.filter((d) => d.doc_id !== docId));
  }

  function handleSelectNode(node: GraphNode | null) {
    setSelectedNodeId(node ? node.id : null);
  }

  return (
    <div className="min-h-screen bg-[#06090f] text-slate-100">
      {/* Subtle Ambient Background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.14),transparent_55%)]" />

      <div className="relative mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6">
        {/* Top Command Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#080d18]/90 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/40 bg-gradient-to-br from-violet-600/30 to-indigo-600/30 text-lg shadow-[0_0_24px_rgba(139,92,246,0.28)]">
              🧠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  AetherMind
                </h1>
                <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-violet-200 uppercase">
                  Ultra Workspace
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Agent Orchestrator · Hybrid Vector Search · Live Knowledge Graph
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                wsConnected
                  ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                  : backendOnline
                    ? "border-sky-400/35 bg-sky-500/10 text-sky-200"
                    : "border-amber-400/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  wsConnected
                    ? "animate-pulse bg-emerald-400"
                    : backendOnline
                      ? "bg-sky-400"
                      : "bg-amber-400"
                }`}
              />
              {wsConnected
                ? "FastAPI WebSocket Live"
                : backendOnline
                  ? "FastAPI REST Online"
                  : "Local Engine Mode"}
            </div>
            {!backendOnline && (
              <button
                type="button"
                onClick={hydrateFromBackend}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Reconnect API
              </button>
            )}
          </div>
        </header>

        {/* Objective Prompt Bar */}
        <section className="rounded-2xl border border-white/10 bg-[#080d18]/90 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRunObjective();
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Enter a complex architecture or AI research objective..."
              className="flex-1 rounded-xl border border-white/10 bg-slate-950/85 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-400"
            />
            <button
              type="submit"
              disabled={isStreaming}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.35)] transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
            >
              {isStreaming ? "Orchestrating..." : "Run Multi-Agent Graph"}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">
              Presets:
            </span>
            {PRESET_OBJECTIVES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setObjective(preset);
                  handleRunObjective(preset);
                }}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-300 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
              >
                {preset}
              </button>
            ))}
          </div>
        </section>

        {/* 3-Column Mission Control Grid */}
        <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)_330px]">
          <div className="h-[600px]">
            <KnowledgeSidebar
              docs={docs}
              searchQuery={searchQuery}
              searchResults={effectiveSearchResults}
              runs={runs}
              activeRunId={activeRun.run_id}
              onSearchChange={setSearchQuery}
              onAddDoc={handleAddDoc}
              onDeleteDoc={handleDeleteDoc}
              onSelectRun={(run) => {
                setActiveRun(run);
                setObjective(run.objective);
                setSelectedNodeId(null);
              }}
              onSelectDocNode={(docId) => setSelectedNodeId(`doc:${docId}`)}
            />
          </div>

          <div className="h-[600px]">
            <KnowledgeGraph
              graph={activeRun.graph}
              isStreaming={isStreaming}
              activeAgent={activeAgent}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
            />
          </div>

          <div className="h-[600px]">
            <AgentTracePanel
              steps={activeRun.steps}
              confidence={activeRun.confidence}
              durationMs={activeRun.duration_ms}
              isStreaming={isStreaming}
              transportMode={transportMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
