"""AetherMind FastAPI entrypoint with REST + WebSocket workspace streaming."""

from __future__ import annotations

import os
from dataclasses import asdict
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.engine.orchestrator import MultiAgentOrchestrator
from app.engine.vector_store import LocalVectorStore

app = FastAPI(
    title="AetherMind API",
    version="0.1.0",
    description="AI Multi-Agent Workspace, Hybrid Vector Search & Knowledge Graph Engine",
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vector_store = LocalVectorStore()
orchestrator = MultiAgentOrchestrator(vector_store)


def _seed_workspace() -> None:
    """Populate starter knowledge nodes for immediate exploration."""
    vector_store.add(
        "arch-overview",
        "AetherMind Core Architecture",
        "Next.js 15 frontend paired with FastAPI, WebSockets, and a hybrid vector search index for live multi-agent orchestration.",
        tags=["architecture", "nextjs", "fastapi", "websockets"],
    )
    vector_store.add(
        "agent-dag",
        "Multi-Agent DAG Protocol",
        "Researcher retrieves grounded workspace evidence, Synthesizer constructs knowledge graph edges, and Critic verifies coverage.",
        tags=["agents", "dag", "graph", "verification"],
    )
    vector_store.add(
        "vector-retrieval",
        "Hybrid Vector Retrieval",
        "TF-IDF and dense embedding cosine similarity scoring with provenance links back to source workspace documents.",
        tags=["vector", "search", "embeddings", "rag"],
    )


_seed_workspace()


class DocumentIn(BaseModel):
    """Payload for indexing a new workspace knowledge document."""

    doc_id: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=20000)
    tags: list[str] = Field(default_factory=list)


class AgentRunRequest(BaseModel):
    """Payload for triggering a multi-agent orchestration pass."""

    objective: str = Field(..., min_length=2, max_length=500)
    top_k: int = Field(default=3, ge=1, le=10)


@app.get("/health")
def health() -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "aethermind-api",
        "indexed_documents": len(vector_store.list_documents()),
    }


@app.get("/api/documents")
def list_documents() -> dict[str, Any]:
    """Return all indexed workspace documents."""
    docs = [
        {
            "doc_id": d.doc_id,
            "title": d.title,
            "content": d.content,
            "tags": list(d.tags),
        }
        for d in vector_store.list_documents()
    ]
    return {"documents": docs}


@app.post("/api/documents", status_code=201)
def add_document(payload: DocumentIn) -> dict[str, Any]:
    """Index a new document into the workspace vector store."""
    doc = vector_store.add(
        doc_id=payload.doc_id,
        title=payload.title,
        content=payload.content,
        tags=payload.tags,
    )
    return {
        "doc_id": doc.doc_id,
        "title": doc.title,
        "tags": list(doc.tags),
    }


@app.get("/api/search")
def search_documents(q: str, top_k: int = 5) -> dict[str, Any]:
    """Run vector similarity search across workspace documents."""
    results = vector_store.search(q, top_k=top_k)
    return {"query": q, "results": [asdict(r) for r in results]}


@app.post("/api/agents/run")
def run_agents(payload: AgentRunRequest) -> dict[str, Any]:
    """Execute the multi-agent pipeline and return trace + knowledge graph."""
    return orchestrator.run(objective=payload.objective, top_k=payload.top_k)


@app.websocket("/ws/workspace")
async def workspace_socket(websocket: WebSocket) -> None:
    """Stream agent pipeline events to connected workspace clients."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            objective = str(data.get("objective", "")).strip()
            if not objective:
                await websocket.send_json({"type": "error", "message": "Objective is required."})
                continue

            result = orchestrator.run(objective=objective)
            for step in result["steps"]:
                await websocket.send_json({"type": "agent_step", "step": step})
            await websocket.send_json({"type": "graph_update", "graph": result["graph"]})
    except WebSocketDisconnect:
        return
