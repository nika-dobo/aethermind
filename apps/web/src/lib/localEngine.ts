import type {
  AgentStep,
  GraphEdge,
  GraphNode,
  RunResult,
  SearchResult,
  WorkspaceDoc,
} from "./types";

export const STARTER_DOCS: WorkspaceDoc[] = [
  {
    doc_id: "arch-overview",
    title: "AetherMind Core Architecture",
    content:
      "Next.js 15 interactive Knowledge Graph canvas paired with Python FastAPI, WebSockets, SQLite persistence, and hybrid TF-IDF vector indexing.",
    tags: ["architecture", "nextjs", "fastapi", "websockets"],
    category: "Architecture",
  },
  {
    doc_id: "agent-dag",
    title: "4-Stage Multi-Agent DAG Protocol",
    content:
      "Planner decomposes objectives, Researcher retrieves grounded workspace evidence, Synthesizer builds knowledge graph nodes and causal edges, and Critic audits coverage confidence.",
    tags: ["agents", "dag", "graph", "verification"],
    category: "AI / ML",
  },
  {
    doc_id: "vector-retrieval",
    title: "Hybrid Vector Retrieval Engine",
    content:
      "TF-IDF and cosine similarity scoring with metadata boosting on titles and tags, returning provenance snippets and matched query terms.",
    tags: ["vector", "search", "embeddings", "rag"],
    category: "AI / ML",
  },
  {
    doc_id: "ws-backpressure",
    title: "WebSocket Streaming & Backpressure",
    content:
      "Real-time full-duplex workspace channel streaming agent lifecycle events, step latencies, and incremental graph mutations to connected clients.",
    tags: ["websockets", "streaming", "realtime", "latency"],
    category: "Systems",
  },
  {
    doc_id: "crdt-canvas",
    title: "Collaborative Graph Canvas State",
    content:
      "Interactive pan, zoom, and draggable vertex coordinates enabling deterministic graph inspection and multi-session trace replay.",
    tags: ["crdt", "canvas", "graph", "ui"],
    category: "Systems",
  },
];

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
  const avgScore =
    hits.length > 0
      ? hits.reduce((sum, h) => sum + h.score, 0) / hits.length
      : 0;
  const confidence = Math.min(
    98,
    Math.max(35, Math.round(42 + hits.length * 10 + avgScore * 32))
  );

  const synthesisTitle = `Blueprint: ${
    objective.length > 42 ? `${objective.slice(0, 42)}...` : objective
  }`;

  const plannerOutput = `Decomposed objective into 3 execution tracks focusing on [${
    focusTerms.join(", ") || "general architecture"
  }].`;
  const researcherOutput =
    hits.length > 0
      ? `Retrieved ${hits.length} grounded knowledge node(s) via TF-IDF cosine similarity. Top match: '${hits[0].title}' (score ${hits[0].score.toFixed(2)}).`
      : "No indexed workspace nodes matched directly; falling back to first-principles synthesis.";
  const synthesizerOutput =
    hits.length > 0
      ? `Synthesized system architecture combining ${hits
          .slice(0, 3)
          .map((h) => h.title)
          .join(", ")}.`
      : `Generated greenfield blueprint for '${objective}'.`;
  const criticOutput =
    hits.length > 0
      ? `Grounding confidence ${confidence}%. Verified ${hits.length} evidence edge(s); recommended next check: load-test WebSocket backpressure & persistence invariants.`
      : `Grounding confidence ${confidence}% (low evidence). Ingest architecture specs to raise grounding.`;

  const steps: AgentStep[] = [
    {
      agent: "Planner",
      role: "Task Decomposition",
      status: "completed",
      latency_ms: 21,
      output: plannerOutput,
      highlights: [
        `Retrieve workspace priors for ${focusTerms.slice(0, 3).join(", ") || "core architecture"}`,
        "Construct causal & dependency edges across matched components",
        "Audit grounding coverage and identify operational bottlenecks",
      ],
    },
    {
      agent: "Researcher",
      role: "Hybrid Vector Retrieval",
      status: "completed",
      latency_ms: 28,
      output: researcherOutput,
      highlights:
        hits.length > 0
          ? hits.map((h) => `${h.title} (${Math.round(h.score * 100)}%)`)
          : ["0 direct matches — add domain docs to strengthen grounding"],
    },
    {
      agent: "Synthesizer",
      role: "Knowledge Graph Builder",
      status: "completed",
      latency_ms: 34,
      output: synthesizerOutput,
      highlights: [
        `Generated node: ${synthesisTitle}`,
        `Linked ${hits.length} evidence sources`,
      ],
    },
    {
      agent: "Critic",
      role: "Verification & Risk Audit",
      status: "completed",
      latency_ms: 24,
      output: criticOutput,
      highlights: [
        `Confidence Score: ${confidence}%`,
        `Evidence Coverage: ${hits.length}/${topK} slots`,
      ],
    },
  ];

  const nodes: GraphNode[] = [
    {
      id: "query:root",
      label: objective,
      kind: "query",
      summary: "Primary user objective",
      tags: focusTerms,
    },
    {
      id: "agent:planner",
      label: "Planner",
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
      id: "agent:synthesizer",
      label: "Synthesizer",
      kind: "agent",
      summary: synthesizerOutput,
    },
    {
      id: "agent:critic",
      label: "Critic",
      kind: "agent",
      summary: criticOutput,
      score: confidence / 100,
    },
    {
      id: "synthesis:blueprint",
      label: synthesisTitle,
      kind: "synthesis",
      summary: `${synthesizerOutput} | ${criticOutput}`,
      score: confidence / 100,
      tags: ["blueprint", confidence >= 70 ? "verified" : "draft"],
    },
  ];

  const edges: GraphEdge[] = [
    { source: "query:root", target: "agent:planner", relation: "decomposes" },
    { source: "agent:planner", target: "agent:researcher", relation: "queries" },
    {
      source: "agent:researcher",
      target: "agent:synthesizer",
      relation: "grounds",
    },
    {
      source: "agent:synthesizer",
      target: "synthesis:blueprint",
      relation: "produces",
    },
    {
      source: "synthesis:blueprint",
      target: "agent:critic",
      relation: "audited_by",
    },
  ];

  for (const hit of hits) {
    const nodeId = `doc:${hit.doc_id}`;
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
      relation: `retrieved (${Math.round(hit.score * 100)}%)`,
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
    duration_ms: 107,
    steps,
    graph: { nodes, edges },
    created_at: new Date().toISOString(),
  };
}
