"use client";

import type { AgentStep } from "@/lib/types";

interface AgentTracePanelProps {
  steps: AgentStep[];
  confidence: number;
  durationMs: number;
  isStreaming: boolean;
  transportMode: "websocket" | "rest" | "local";
}

export function AgentTracePanel({
  steps,
  confidence,
  durationMs,
  isStreaming,
  transportMode,
}: AgentTracePanelProps) {
  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080d18]/90">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-4 py-3">
        <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
          AI Team Progress
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300 uppercase">
          {transportMode === "websocket"
            ? "WS Stream"
            : transportMode === "rest"
              ? "FastAPI REST"
              : "Local Engine"}
        </span>
      </div>

      {/* Confidence & Telemetry */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Grounding Confidence</span>
          <span className="font-bold text-white">{confidence}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-sky-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${confidence}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>Pipeline Latency: {durationMs}ms</span>
          <span>{isStreaming ? "Streaming..." : "Idle"}</span>
        </div>
      </div>

      {/* 4-Stage Pipeline */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {steps.map((step, index) => {
          const isRunning = step.status === "running";
          const isDone = step.status === "completed";

          return (
            <div
              key={step.agent}
              className={`rounded-xl border p-3.5 transition ${
                isRunning
                  ? "border-violet-400/60 bg-violet-500/10 shadow-[0_0_24px_rgba(139,92,246,0.16)]"
                  : isDone
                    ? "border-white/10 bg-slate-950/70"
                    : "border-white/5 bg-slate-950/35 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isRunning
                        ? "animate-pulse bg-violet-500 text-white"
                        : isDone
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-white">
                      {step.agent}
                    </h3>
                    <p className="text-[10px] text-slate-400">{step.role}</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400">
                  {isRunning
                    ? "active"
                    : isDone
                      ? `${step.latency_ms}ms`
                      : "queued"}
                </span>
              </div>

              {step.output && (
                <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                  {step.output}
                </p>
              )}

              {step.highlights.length > 0 && (
                <ul className="mt-2.5 flex flex-col gap-1 border-t border-white/10 pt-2">
                  {step.highlights.map((item, i) => (
                    <li
                      key={`${step.agent}-hl-${i}`}
                      className="text-[11px] text-slate-400"
                    >
                      • {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
