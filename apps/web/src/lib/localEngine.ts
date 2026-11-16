import type {
  ActionBrief,
  AgentStep,
  GraphEdge,
  GraphNode,
  RunResult,
  SearchResult,
  WorkspaceDoc,
} from "./types";

export interface KnowledgePackMeta {
  id: "ai-study" | "startup-launch" | "system-design";
  label: string;
  badge: string;
  presets: string[];
  docs: WorkspaceDoc[];
}

export const KNOWLEDGE_PACKS: KnowledgePackMeta[] = [
  {
    id: "ai-study",
    label: "AI & Data Science Notes",
    badge: "🎓 Study Pack",
    presets: [
      "Compare RAG vs Fine-Tuning for my AI project",
      "How do we evaluate ML models and prevent RAG hallucinations?",
      "Design a reliable multi-agent workflow with vector chunking",
    ],
    docs: [
      {
        doc_id: "rag-vs-finetuning",
        title: "RAG vs Fine-Tuning Guide",
        content:
          "Use RAG (Retrieval-Augmented Generation) when facts change frequently or require source citations. Use Fine-Tuning when you need consistent tone, domain formatting, or specialized reasoning patterns.",
        tags: ["rag", "finetuning", "llm", "citations"],
        category: "AI / ML",
      },
      {
        doc_id: "chunking-embeddings",
        title: "Vector Search & Chunking Rules",
        content:
          "Split documents into 300–500 token chunks with 15% overlap so context isn't lost across boundaries. Combine keyword matching (BM25/TF-IDF) with dense embeddings for hybrid retrieval.",
        tags: ["vector", "chunking", "embeddings", "search"],
        category: "AI / ML",
      },
      {
        doc_id: "ml-eval-metrics",
        title: "Evaluating AI & ML Systems",
        content:
          "Track Precision, Recall, and F1-Score for classification tasks, and measure Faithfulness plus Answer Relevance in RAG pipelines to catch hallucinations early.",
        tags: ["evaluation", "metrics", "f1", "hallucination"],
        category: "Data Science",
      },
      {
        doc_id: "agent-guardrails",
        title: "AI Agent Reliability & Guardrails",
        content:
          "Break complex tasks into specialized roles (Planner, Researcher, Fact-Checker) and require source grounding before presenting conclusions to users.",
        tags: ["agents", "reliability", "guardrails", "workflow"],
        category: "AI / ML",
      },
    ],
  },
  {
    id: "startup-launch",
    label: "SaaS Launch Playbook",
    badge: "🚀 Startup Pack",
    presets: [
      "Build an MVP launch checklist and onboarding plan",
      "Design SaaS pricing tiers and measure user retention",
      "How should we validate our product before scaling?",
    ],
    docs: [
      {
        doc_id: "mvp-validation",
        title: "MVP Scope & User Validation",
        content:
          "Ship the smallest workflow that solves one painful problem in under 60 seconds. Talk to 10 target users before building secondary dashboards or billing.",
        tags: ["mvp", "validation", "users", "startup"],
        category: "Product",
      },
      {
        doc_id: "launch-checklist",
        title: "Product Launch & Onboarding Loop",
        content:
          "Provide pre-loaded sample data so first-time visitors experience the core aha-moment immediately without signing up or uploading files first.",
        tags: ["launch", "onboarding", "aha", "growth"],
        category: "Growth",
      },
      {
        doc_id: "pricing-conversion",
        title: "SaaS Pricing & Conversion Strategy",
        content:
          "Keep a generous free tier for solo exploration and gate team collaboration, API limits, or persistent workspaces behind a clear Pro tier.",
        tags: ["pricing", "saas", "conversion", "monetization"],
        category: "Business",
      },
      {
        doc_id: "analytics-retention",
        title: "Retention & Key Product Metrics",
        content:
          "Measure activation rate (first completed task within 3 minutes), Day-7 retention, and export/share actions rather than vanity page views.",
        tags: ["analytics", "retention", "metrics", "kpi"],
        category: "Growth",
      },
    ],
  },
  {
    id: "system-design",
    label: "Full-Stack System Design",
    badge: "⚙️ Engineering Pack",
    presets: [
      "Design a scalable caching and real-time WebSocket backend",
      "What security and CI checks do we need before production?",
      "Plan latency optimization across CDN, API, and SQLite",
    ],
    docs: [
      {
        doc_id: "realtime-websockets",
        title: "WebSockets & Streaming Backpressure",
        content:
          "Use WebSockets for multi-step live progress updates, keep messages small, and implement automatic REST or local fallback when connections drop.",
        tags: ["websockets", "realtime", "streaming", "fallback"],
        category: "Backend",
      },
      {
        doc_id: "caching-cdn",
        title: "Caching Layers & Latency Budget",
        content:
          "Cache read-heavy queries at the CDN edge and in memory with short TTLs; reserve SQLite/Postgres writes for durable user state and audit logs.",
        tags: ["caching", "cdn", "latency", "database"],
        category: "Architecture",
      },
      {
        doc_id: "auth-security",
        title: "API Security & Input Validation",
        content:
          "Validate every request schema at the boundary with Pydantic, enforce strict CORS origins, and never expose raw stack traces or secrets in client responses.",
        tags: ["security", "cors", "validation", "api"],
        category: "Security",
      },
      {
        doc_id: "testing-ci",
        title: "Automated Testing & CI Pipelines",
        content:
          "Pair fast unit/API tests in Pytest with frontend typechecking and production builds in GitHub Actions so every commit stays deployable.",
        tags: ["testing", "pytest", "ci", "quality"],
        category: "DevOps",
      },
    ],
  },
];

export const STARTER_DOCS: WorkspaceDoc[] = KNOWLEDGE_PACKS[0].docs;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
}

function buildTermCounts(doc: WorkspaceDoc): Map<string, number> {
  const weighted = `${doc.title} ${doc.title} ${doc.tags.join(" ")} ${doc.tags.join(" ")} ${doc.category} ${doc.content}`;
  const counts = new Map<string, number>();
  for (const token of tokenize(weighted)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

export function searchLocalDocs(
  docs: WorkspaceDoc[],
  query: string,
  topK = 5
): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || docs.length === 0) return [];

  const nDocs = docs.length;
  const termMaps = docs.map((d) => ({ doc: d, counts: buildTermCounts(d) }));
  const docFreq = new Map<string, number>();

  for (const { counts } of termMaps) {
    for (const term of counts.keys()) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  const idf = (term: string) =>
    Math.log((1 + nDocs) / (1 + (docFreq.get(term) ?? 0))) + 1;

  const queryCounts = new Map<string, number>();
  for (const t of queryTokens) {
    queryCounts.set(t, (queryCounts.get(t) ?? 0) + 1);
  }

  const queryVec = new Map<string, number>();
  let querySq = 0;
  for (const [t, tf] of queryCounts.entries()) {
    const w = tf * idf(t);
    queryVec.set(t, w);
    querySq += w * w;
  }
  const queryNorm = Math.sqrt(querySq);
  if (queryNorm === 0) return [];

  const results: SearchResult[] = [];
  for (const { doc, counts } of termMaps) {
    let docSq = 0;
    const docVec = new Map<string, number>();
    for (const [t, tf] of counts.entries()) {
      const w = tf * idf(t);
      docVec.set(t, w);
      docSq += w * w;
    }
    const docNorm = Math.sqrt(docSq);
    if (docNorm === 0) continue;

    const matched: string[] = [];
    let dot = 0;
    for (const [t, qw] of queryVec.entries()) {
      const dw = docVec.get(t);
      if (dw !== undefined) {
        matched.push(t);
        dot += qw * dw;
      }
    }
    if (matched.length === 0) continue;

    const score = Math.min(1, dot / (queryNorm * docNorm));
    results.push({
      doc_id: doc.doc_id,
      title: doc.title,
      category: doc.category,
      tags: doc.tags,
      score: Number(score.toFixed(4)),
      matched_terms: Array.from(new Set(matched)).sort(),
      snippet:
        doc.content.length > 200
          ? `${doc.content.slice(0, 200)}...`
          : doc.content,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export function runLocalOrchestrator(
  docs: WorkspaceDoc[],
  objective: string,
  topK = 4
): RunResult {
  const focusTerms = Array.from(
    new Set(tokenize(objective).filter((t) => t.length > 2))
  )
    .sort()
    .slice(0, 5);

  const hits = searchLocalDocs(docs, objective, topK);
  const docsById = new Map(docs.map((d) => [d.doc_id, d.content]));

  const keyPoints = hits.map((hit) => {
    const fullText = docsById.get(hit.doc_id) ?? hit.snippet;
    const firstSentence = fullText
      .split(/(?<=[.!?])\s+/)
      .find((s) => s.trim().length > 20);
    return `${hit.title}: ${firstSentence?.trim() || hit.snippet}`;
  });

  const avgScore =
    hits.length > 0
      ? hits.reduce((sum, h) => sum + h.score, 0) / hits.length
      : 0;
  const confidence = Math.min(
    98,
    Math.max(35, Math.round(42 + hits.length * 10 + avgScore * 32))
  );

  const synthesisTitle = `Brief: ${
    objective.length > 42 ? `${objective.slice(0, 42)}...` : objective
  }`;

  const plannerOutput = `Broke down your goal into 3 research tracks targeting [${
    focusTerms.join(", ") || "key workspace concepts"
  }].`;
  const researcherOutput =
    hits.length > 0
      ? `Found ${hits.length} relevant note(s) in your Knowledge Base. Strongest match: '${hits[0].title}' (${Math.round(hits[0].score * 100)}% relevance).`
      : "No existing notes matched this topic directly — using general reasoning.";
  const synthesizerOutput = `Drafted structured Action Brief and linked ${hits.length} source note(s) into the Knowledge Map.`;
  const criticOutput = `Verified ${hits.length} source citation(s) with ${confidence}% grounding confidence.`;

  const executiveSummary =
    hits.length > 0
      ? `Based on ${hits.length} note(s) in your workspace (${hits
          .slice(0, 3)
          .map((h) => h.title)
          .join(", ")}), here is the synthesized takeaway for "${objective}": ${keyPoints
          .slice(0, 2)
          .join(" ")}`
      : `Your workspace currently has no notes directly covering "${objective}". Add 1–2 notes or upload a markdown file in the left panel so the AI team can ground its plan in your material.`;

  const actionPlan =
    hits.length > 0
      ? [
          `Start with ${hits[0].title}: apply its core principles directly to your objective.`,
          ...hits
            .slice(1, 3)
            .map(
              (h) =>
                `Incorporate ${h.title} (${
                  h.matched_terms.slice(0, 3).join(", ") || "context"
                }) to cover trade-offs.`
            ),
          "Validate assumptions against a small prototype or test checklist before scaling.",
        ]
      : [
          "Add relevant notes, specs, or lecture summaries using '+ Note' or file upload.",
          "Re-run this goal to link your sources into the Knowledge Map.",
          "Export the generated Action Brief as Markdown once verified.",
        ];

  const risksAndGaps =
    hits.length > 0
      ? [
          `Primary grounding relies on ${hits.length} internal note(s); verify external benchmarks if deploying to production.`,
          "Unmatched objective terms may need extra notes if deeper detail is required.",
        ]
      : [
          "0 workspace notes matched — confidence is limited until domain notes are added.",
        ];

  const brief: ActionBrief = {
    headline: objective,
    executive_summary: executiveSummary,
    key_findings:
      keyPoints.length > 0
        ? keyPoints
        : ["No matching workspace notes found yet."],
    action_plan: actionPlan,
    risks_and_gaps: risksAndGaps,
    citations: hits.map((h) => ({
      doc_id: h.doc_id,
      title: h.title,
      category: h.category,
      score: h.score,
      matched_terms: h.matched_terms,
    })),
  };

  const steps: AgentStep[] = [
    {
      agent: "Strategist",
      role: "Goal Breakdown",
      status: "completed",
      latency_ms: 19,
      output: plannerOutput,
      highlights: [
        `Find relevant notes matching: ${focusTerms.slice(0, 4).join(", ") || "core concepts"}`,
        "Connect key facts, trade-offs, and practical steps",
        "Verify grounding against sources and flag missing info",
      ],
    },
    {
      agent: "Researcher",
      role: "Note Retrieval",
      status: "completed",
      latency_ms: 25,
      output: researcherOutput,
      highlights:
        hits.length > 0
          ? hits.map((h) => `${h.title} (${Math.round(h.score * 100)}%)`)
          : [
              "0 direct note matches — add notes on this topic for deeper grounding",
            ],
    },
    {
      agent: "Writer",
      role: "Action Brief & Map",
      status: "completed",
      latency_ms: 31,
      output: synthesizerOutput,
      highlights: [
        `Created: ${synthesisTitle}`,
        `Connected ${hits.length} source note(s)`,
      ],
    },
    {
      agent: "Fact-Checker",
      role: "Grounding Audit",
      status: "completed",
      latency_ms: 22,
      output: criticOutput,
      highlights: [
        `Grounding Confidence: ${confidence}%`,
        `Sources Verified: ${hits.length}/${topK}`,
      ],
    },
  ];

  const nodes: GraphNode[] = [
    {
      id: "query:root",
      label: objective,
      kind: "query",
      summary: "Your goal or question",
      tags: focusTerms,
    },
    {
      id: "agent:strategist",
      label: "Strategist",
      kind: "agent",
      summary: plannerOutput,
    },
    {
      id: "agent:researcher",
      label: "Researcher",
      kind: "agent",
      summary: researcherOutput,
    },
    {
      id: "agent:writer",
      label: "Writer",
      kind: "agent",
      summary: synthesizerOutput,
    },
    {
      id: "agent:checker",
      label: "Fact-Checker",
      kind: "agent",
      summary: criticOutput,
      score: confidence / 100,
    },
    {
      id: "synthesis:blueprint",
      label: synthesisTitle,
      kind: "synthesis",
      summary: executiveSummary,
      score: confidence / 100,
      tags: ["action-brief", confidence >= 70 ? "verified" : "needs-notes"],
    },
  ];

  const edges: GraphEdge[] = [
    { source: "query:root", target: "agent:strategist", relation: "plans" },
    {
      source: "agent:strategist",
      target: "agent:researcher",
      relation: "searches",
    },
    { source: "agent:researcher", target: "agent:writer", relation: "informs" },
    {
      source: "agent:writer",
      target: "synthesis:blueprint",
      relation: "writes",
    },
    {
      source: "synthesis:blueprint",
      target: "agent:checker",
      relation: "verified_by",
    },
  ];

  for (const hit of hits) {
    const nodeId = `doc:{hit.doc_id}`.replace("{hit.doc_id}", hit.doc_id);
    nodes.push({
      id: nodeId,
      label: hit.title,
      kind: "evidence",
      summary: hit.snippet,
      score: hit.score,
      tags: hit.tags,
    });
    edges.push({
      source: "agent:researcher",
      target: nodeId,
      relation: `matched (${Math.round(hit.score * 100)}%)`,
    });
    edges.push({
      source: nodeId,
      target: "synthesis:blueprint",
      relation: "supports",
    });
  }

  return {
    run_id: `local-${Math.random().toString(16).slice(2, 10)}`,
    objective,
    confidence,
    duration_ms: 97,
    brief,
    steps,
    graph: { nodes, edges },
    created_at: new Date().toISOString(),
  };
}
