"use client";

import { useState } from "react";
import type { ActionBrief } from "@/lib/types";

interface ActionBriefPanelProps {
  brief: ActionBrief;
  confidence: number;
  onHighlightCitation: (docId: string) => void;
}

function formatBriefAsMarkdown(brief: ActionBrief, confidence: number): string {
  const lines = [
    `# ${brief.headline}`,
    "",
    `**Grounding Confidence:** ${confidence}%`,
    "",
    "## Executive Summary",
    brief.executive_summary,
    "",
    "## Key Findings from Your Notes",
    ...brief.key_findings.map((item) => `- ${item}`),
    "",
    "## Recommended Action Plan",
    ...brief.action_plan.map((step, i) => `${i + 1}. ${step}`),
    "",
    "## Risks & Knowledge Gaps",
    ...brief.risks_and_gaps.map((risk) => `- ${risk}`),
    "",
    "## Sources Cited",
    ...brief.citations.map(
      (c) => `- **${c.title}** (${c.category} · ${Math.round(c.score * 100)}% match)`
    ),
  ];
  return lines.join("\n");
}

export function ActionBriefPanel({
  brief,
  confidence,
  onHighlightCitation,
}: ActionBriefPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyMarkdown() {
    const md = formatBriefAsMarkdown(brief, confidence);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownloadMarkdown() {
    const md = formatBriefAsMarkdown(brief, confidence);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aethermind-action-brief.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080d18]/90">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">📄</span>
          <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Action Brief (Final Answer)
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            {copied ? "Copied ✓" : "Copy .md"}
          </button>
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-200 transition hover:bg-violet-500/25"
          >
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div>
          <span className="inline-block rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 uppercase">
            Synthesized Output · {confidence}% Grounded
          </span>
          <h3 className="mt-2 text-base font-bold text-white">{brief.headline}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {brief.executive_summary}
          </p>
        </div>

        {/* Action Plan */}
        <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-4">
          <h4 className="text-xs font-semibold tracking-wider text-violet-200 uppercase">
            Recommended Next Steps
          </h4>
          <ol className="mt-2.5 flex flex-col gap-2">
            {brief.action_plan.map((step, idx) => (
              <li
                key={`plan-${idx}`}
                className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-200"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/30 text-[10px] font-bold text-violet-200">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Key Findings */}
        <div>
          <h4 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
            Key Evidence Extracted
          </h4>
          <ul className="mt-2 flex flex-col gap-2">
            {brief.key_findings.map((finding, idx) => (
              <li
                key={`finding-${idx}`}
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-xs leading-relaxed text-slate-300"
              >
                {finding}
              </li>
            ))}
          </ul>
        </div>

        {/* Risks & Gaps */}
        <div>
          <h4 className="text-xs font-semibold tracking-wider text-amber-300 uppercase">
            Fact-Checker Notes &amp; Gaps
          </h4>
          <ul className="mt-2 flex flex-col gap-1.5">
            {brief.risks_and_gaps.map((risk, idx) => (
              <li
                key={`risk-${idx}`}
                className="text-xs leading-relaxed text-slate-400"
              >
                • {risk}
              </li>
            ))}
          </ul>
        </div>

        {/* Source Citations */}
        {brief.citations.length > 0 && (
          <div className="border-t border-white/10 pt-3">
            <h4 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Sources Used (click to inspect in Mind-Map)
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {brief.citations.map((c) => (
                <button
                  key={c.doc_id}
                  type="button"
                  onClick={() => onHighlightCitation(c.doc_id)}
                  className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-500/20"
                >
                  {c.title} · {Math.round(c.score * 100)}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
