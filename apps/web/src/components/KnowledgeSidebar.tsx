"use client";

import { useState } from "react";
import type { RunResult, SearchResult, WorkspaceDoc } from "@/lib/types";

interface KnowledgeSidebarProps {
  docs: WorkspaceDoc[];
  searchQuery: string;
  searchResults: SearchResult[];
  runs: RunResult[];
  activeRunId: string;
  onSearchChange: (q: string) => void;
  onAddDoc: (doc: {
    title: string;
    content: string;
    tags: string[];
    category: string;
  }) => Promise<void>;
  onDeleteDoc: (docId: string) => Promise<void>;
  onSelectRun: (run: RunResult) => void;
  onSelectDocNode: (docId: string) => void;
}

export function KnowledgeSidebar({
  docs,
  searchQuery,
  searchResults,
  runs,
  activeRunId,
  onSearchChange,
  onAddDoc,
  onDeleteDoc,
  onSelectRun,
  onSelectDocNode,
}: KnowledgeSidebarProps) {
  const [tab, setTab] = useState<"knowledge" | "history">("knowledge");
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [category, setCategory] = useState("Architecture");
  const [saving, setSaving] = useState(false);

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await onAddDoc({
        title: title.trim(),
        content: content.trim(),
        tags,
        category,
      });
      setTitle("");
      setContent("");
      setTagsRaw("");
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080d18]/90">
      {/* Tabs */}
      <div className="grid grid-cols-2 border-b border-white/10 bg-slate-950/60 p-1.5">
        <button
          type="button"
          onClick={() => setTab("knowledge")}
          className={`rounded-xl py-2 text-xs font-semibold transition ${
            tab === "knowledge"
              ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Knowledge ({docs.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`rounded-xl py-2 text-xs font-semibold transition ${
            tab === "history"
              ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Runs ({runs.length})
        </button>
      </div>

      {tab === "knowledge" ? (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {/* Vector Search Bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Vector search (rag, crdt, ws...)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-400"
            />
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="shrink-0 rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/25"
            >
              {showAddForm ? "Close" : "+ Node"}
            </button>
          </div>

          {/* Add Document Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreateDoc}
              className="flex flex-col gap-2.5 rounded-xl border border-violet-400/25 bg-slate-950/80 p-3"
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Knowledge node title"
                className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-400"
                required
              />
              <textarea
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Technical notes, architecture spec, or findings..."
                className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-400"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="tags: rag, ai"
                  className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-400"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white outline-none"
                >
                  <option value="Architecture">Architecture</option>
                  <option value="AI / ML">AI / ML</option>
                  <option value="Systems">Systems</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-violet-600 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {saving ? "Indexing..." : "Index in Vector Store"}
              </button>
            </form>
          )}

          {/* Vector Search Hits */}
          {searchQuery.trim().length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Vector Matches ({searchResults.length})
              </p>
              {searchResults.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
                  No matching documents found.
                </div>
              ) : (
                searchResults.map((hit) => (
                  <div
                    key={hit.doc_id}
                    onClick={() => onSelectDocNode(hit.doc_id)}
                    className="cursor-pointer rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3 transition hover:border-emerald-400/45"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">
                        {hit.title}
                      </span>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        {Math.round(hit.score * 100)}%
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-400">
                      {hit.snippet}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {hit.matched_terms.map((term) => (
                        <span
                          key={term}
                          className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-emerald-200"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Full Document List */
            <div className="flex flex-col gap-2">
              {docs.map((doc) => (
                <div
                  key={doc.doc_id}
                  onClick={() => onSelectDocNode(doc.doc_id)}
                  className="group cursor-pointer rounded-xl border border-white/10 bg-slate-950/60 p-3 transition hover:border-violet-400/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold tracking-wider text-violet-300 uppercase">
                        {doc.category}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-100">
                        {doc.title}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDoc(doc.doc_id);
                      }}
                      className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-300"
                      title="Delete node"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                    {doc.content}
                  </p>
                  {doc.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Run History Tab */
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          {runs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
              Run an objective to record trace history.
            </div>
          ) : (
            runs.map((run) => {
              const isActive = run.run_id === activeRunId;
              return (
                <button
                  type="button"
                  key={run.run_id}
                  onClick={() => onSelectRun(run)}
                  className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition ${
                    isActive
                      ? "border-violet-400/50 bg-violet-500/15"
                      : "border-white/10 bg-slate-950/60 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      {run.confidence}% confidence
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {run.duration_ms}ms
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs font-medium text-slate-100">
                    {run.objective}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {run.graph.nodes.length} nodes · {run.graph.edges.length} edges
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
}
