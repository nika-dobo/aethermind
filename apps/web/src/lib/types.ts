export type NodeKind = "query" | "agent" | "evidence" | "synthesis";

export type AgentStatus = "waiting" | "running" | "completed";

export interface WorkspaceDoc {
  doc_id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  created_at?: string;
}

export interface SearchResult {
  doc_id: string;
  title: string;
  category: string;
  tags: string[];
  score: number;
  matched_terms: string[];
  snippet: string;
}

export interface AgentStep {
  agent: string;
  role: string;
  status: AgentStatus;
  latency_ms: number;
  output: string;
  highlights: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  summary: string;
  score?: number | null;
  tags?: string[] | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BriefCitation {
  doc_id: string;
  title: string;
  category: string;
  score: number;
  matched_terms: string[];
}

export interface ActionBrief {
  headline: string;
  executive_summary: string;
  key_findings: string[];
  action_plan: string[];
  risks_and_gaps: string[];
  citations: BriefCitation[];
}

export interface RunResult {
  run_id: string;
  objective: string;
  confidence: number;
  duration_ms: number;
  brief: ActionBrief;
  steps: AgentStep[];
  graph: KnowledgeGraphData;
  created_at?: string;
}
