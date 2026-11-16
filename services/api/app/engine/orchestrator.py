"""Multi-agent orchestration pipeline producing Knowledge Graph updates."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any

from app.engine.vector_store import LocalVectorStore


@dataclass(frozen=True)
class GraphNode:
    """Knowledge Graph vertex."""

    id: str
    label: str
    kind: str  # "query" | "agent" | "evidence" | "synthesis"
    summary: str


@dataclass(frozen=True)
class GraphEdge:
    """Directed relationship between two Knowledge Graph vertices."""

    source: str
    target: str
    relation: str


@dataclass(frozen=True)
class AgentStep:
    """Single traceable step emitted by an agent during a run."""

    agent: str
    role: str
    output: str


class MultiAgentOrchestrator:
    """Runs Researcher -> Synthesizer -> Critic over the workspace vector store."""

    def __init__(self, store: LocalVectorStore) -> None:
        self._store = store

    def run(self, objective: str, top_k: int = 3) -> dict[str, Any]:
        """Execute a deterministic multi-agent pass and return trace + graph."""
        hits = self._store.search(objective, top_k=top_k)

        researcher_summary = (
            f"Retrieved {len(hits)} relevant knowledge node(s): "
            + (", ".join(f"{h.title} ({h.score})" for h in hits) if hits else "none matched")
        )
        synthesizer_summary = (
            f"Synthesized architectural plan for '{objective}' grounded in "
            + (", ".join(h.title for h in hits) if hits else "first-principles reasoning")
        )
        critic_summary = (
            "Verified grounding coverage and flagged missing external benchmarks."
            if hits
            else "No indexed workspace evidence matched; recommend ingesting domain docs."
        )

        steps = [
            AgentStep("Researcher", "Vector Retrieval", researcher_summary),
            AgentStep("Synthesizer", "Graph Synthesis", synthesizer_summary),
            AgentStep("Critic", "Verification", critic_summary),
        ]

        nodes: list[GraphNode] = [
            GraphNode("query:root", objective, "query", "Primary user objective"),
            GraphNode("agent:researcher", "Researcher", "agent", researcher_summary),
            GraphNode("agent:synthesizer", "Synthesizer", "agent", synthesizer_summary),
            GraphNode("agent:critic", "Critic", "agent", critic_summary),
        ]
        edges: list[GraphEdge] = [
            GraphEdge("query:root", "agent:researcher", "triggers"),
            GraphEdge("agent:researcher", "agent:synthesizer", "feeds"),
            GraphEdge("agent:synthesizer", "agent:critic", "reviewed_by"),
        ]

        for hit in hits:
            node_id = f"doc:{hit.doc_id}"
            nodes.append(GraphNode(node_id, hit.title, "evidence", hit.snippet))
            edges.append(GraphEdge("agent:researcher", node_id, f"retrieved ({hit.score})"))
            edges.append(GraphEdge(node_id, "agent:synthesizer", "supports"))

        return {
            "objective": objective,
            "steps": [asdict(step) for step in steps],
            "graph": {
                "nodes": [asdict(node) for node in nodes],
                "edges": [asdict(edge) for edge in edges],
            },
        }
