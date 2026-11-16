"use client";

import { useState } from "react";

interface AgentStep {
  agent: string;
  role: string;
  output: string;
}

interface GraphNode {
  id: string;
  label: string;
  kind: string;
  summary: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

interface RunResult {
  objective: string;
  steps: AgentStep[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function HomePage() {
  const [objective, setObjective] = useState(
    "Design a hybrid vector search + multi-agent reasoning graph"
  );
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/agents/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: objective.trim(), top_k: 3 }),
      });
      if (!res.ok) {
        throw new Error(`API responded with status ${res.status}`);
      }
      const data: RunResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} (Make sure FastAPI is running on ${API_URL})`
          : "Failed to reach AetherMind API"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-violet-300 uppercase">
            Ultra Workspace · v0.1
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            AetherMind
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            AI Multi-Agent Orchestrator, Vector Retrieval &amp; Knowledge Graph Engine
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-300">
          API Target: <code className="text-violet-300">{API_URL}</code>
        </div>
      </header>

      <form
        onSubmit={handleRun}
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:flex-row"
      >
        <input
          type="text"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Enter a research or engineering objective..."
          className="flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
        >
          {loading ? "Running Agents..." : "Run Multi-Agent Graph"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      )}

      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-slate-300 uppercase">
              Agent Execution Trace ({result.steps.length})
            </h2>
            <div className="flex flex-col gap-3">
              {result.steps.map((step) => (
                <div
                  key={step.agent}
                  className="rounded-xl border border-white/10 bg-slate-950/70 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-violet-300">{step.agent}</span>
                    <span className="text-xs text-slate-400">{step.role}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{step.output}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-slate-300 uppercase">
              Knowledge Graph ({result.graph.nodes.length} nodes ·{" "}
              {result.graph.edges.length} edges)
            </h2>
            <div className="flex flex-col gap-2">
              {result.graph.nodes.map((node) => (
                <div
                  key={node.id}
                  className="rounded-xl border border-white/10 bg-slate-950/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{node.label}</span>
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-400 uppercase">
                      {node.kind}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{node.summary}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
