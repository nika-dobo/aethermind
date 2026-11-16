"""AetherMind FastAPI entrypoint with SQLite persistence, REST, and WebSocket streaming."""

from __future__ import annotations

import asyncio
import os
from dataclasses import asdict
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.engine.orchestrator import MultiAgentOrchestrator
from app.engine.storage import WorkspaceStorage
from app.engine.vector_store import LocalVectorStore

app = FastAPI(
    title="AetherMind API",
    version="0.2.0",
    description="AI Multi-Agent Workspace, Hybrid Vector Search & Knowledge Graph Engine",
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_path = os.getenv("DATABASE_PATH", "aethermind.db")
storage = WorkspaceStorage(db_path=db_path)
vector_store = LocalVectorStore()
orchestrator = MultiAgentOrchestrator(vector_store)

STARTER_DOCS = [
    (
        "arch-overview",
        "AetherMind Core Architecture",
        "Next.js 15 interactive Knowledge Graph canvas paired with Python FastAPI, WebSockets, SQLite persistence, and hybrid TF-IDF vector indexing.",
        ["architecture", "nextjs", "fastapi", "websockets"],
        "Architecture",
    ),
    (
        "agent-dag",
        "4-Stage Multi-Agent DAG Protocol",
        "Planner decomposes objectives, Researcher retrieves grounded workspace evidence, Synthesizer builds knowledge graph nodes and causal edges, and Critic audits coverage confidence.",
        ["agents", "dag", "graph", "verification"],
        "AI / ML",
    ),
    (
        "vector-retrieval",
        "Hybrid Vector Retrieval Engine",
        "TF-IDF and cosine similarity scoring with metadata boosting on titles and tags, returning provenance snippets and matched query terms.",
        ["vector", "search", "embeddings", "rag"],
        "AI / ML",
    ),
    (
        "ws-backpressure",
        "WebSocket Streaming & Backpressure",
        "Real-time full-duplex workspace channel streaming agent lifecycle events, step latencies, and incremental graph mutations to connected clients.",
        ["websockets", "streaming", "realtime", "latency"],
        "Systems",
    ),
    (
        "crdt-canvas",
        "Collaborative Graph Canvas State",
        "Interactive pan, zoom, and draggable vertex coordinates enabling deterministic graph inspection and multi-session trace replay.",
        ["crdt", "canvas", "graph", "ui"],
        "Systems",
    ),
]


def _bootstrap_workspace() -> None:
    """Seed starter documents on first boot and hydrate the vector store from SQLite."""
    existing = storage.list_documents()
    if not existing:
        for doc_id, title, content, tags, category in STARTER_DOCS:
            storage.upsert_document(doc_id, title, content, tags, category)
        existing = storage.list_documents()

    for doc in existing:
        vector_store.add(
            doc_id=doc.doc_id,
            title=doc.title,
            content=doc.content,
            tags=doc.tags,
            category=doc.category,
        )


_bootstrap_workspace()


class DocumentIn(BaseModel):
    """Payload for indexing a new workspace knowledge document."""

    doc_id: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=20000)
    tags: list[str] = Field(default_factory=list)
    category: str = Field(default="Custom", min_length=1, max_length=40)


class AgentRunRequest(BaseModel):
    """Payload for triggering a multi-agent orchestration pass."""

    objective: str = Field(..., min_length=2, max_length=500)
    top_k: int = Field(default=4, ge=1, le=10)


@app.get("/health")
def health() -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "aethermind-api",
        "version": "0.2.0",
        "indexed_documents": len(vector_store.list_documents()),
        "saved_runs": len(storage.list_runs(limit=100)),
    }


@app.get("/api/documents")
def list_documents() -> dict[str, Any]:
    """Return all persisted workspace documents."""
    docs = [
        {
            "doc_id": d.doc_id,
            "title": d.title,
            "content": d.content,
            "tags": d.tags,
            "category": d.category,
            "created_at": d.created_at,
        }
        for d in storage.list_documents()
    ]
    return {"documents": docs}


@app.post("/api/documents", status_code=201)
def add_document(payload: DocumentIn) -> dict[str, Any]:
    """Persist and index a new document into the workspace vector store."""
    saved = storage.upsert_document(
        doc_id=payload.doc_id,
        title=payload.title,
        content=payload.content,
        tags=payload.tags,
        category=payload.category,
    )
    vector_store.add(
        doc_id=saved.doc_id,
        title=saved.title,
        content=saved.content,
        tags=saved.tags,
        category=saved.category,
    )
    return {
        "doc_id": saved.doc_id,
        "title": saved.title,
        "content": saved.content,
        "tags": saved.tags,
        "category": saved.category,
        "created_at": saved.created_at,
    }


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str) -> dict[str, Any]:
    """Remove a document from both SQLite and the vector index."""
    removed_db = storage.delete_document(doc_id)
    removed_idx = vector_store.remove(doc_id)
    if not (removed_db or removed_idx):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": doc_id}


@app.get("/api/search")
def search_documents(q: str, top_k: int = 5) -> dict[str, Any]:
    """Run hybrid vector similarity search across workspace documents."""
    results = vector_store.search(q, top_k=top_k)
    return {"query": q, "results": [asdict(r) for r in results]}


@app.get("/api/runs")
def list_runs(limit: int = 12) -> dict[str, Any]:
    """Return recent persisted multi-agent runs."""
    runs = [
        {
            "run_id": r.run_id,
            "objective": r.objective,
            "confidence": r.confidence,
            "duration_ms": r.duration_ms,
            "steps": r.steps,
            "graph": r.graph,
            "created_at": r.created_at,
        }
        for r in storage.list_runs(limit=limit)
    ]
    return {"runs": runs}


@app.post("/api/agents/run")
def run_agents(payload: AgentRunRequest) -> dict[str, Any]:
    """Execute the 4-stage multi-agent pipeline, persist run, and return trace + graph."""
    result = orchestrator.run(objective=payload.objective, top_k=payload.top_k)
    storage.save_run(
        run_id=result["run_id"],
        objective=result["objective"],
        confidence=result["confidence"],
        duration_ms=result["duration_ms"],
        steps=result["steps"],
        graph=result["graph"],
    )
    return result


@app.websocket("/ws/workspace")
async def workspace_socket(websocket: WebSocket) -> None:
    """Stream agent pipeline events to connected workspace clients."""
    await websocket.accept()
    await websocket.send_json(
        {
            "type": "ready",
            "indexed_documents": len(vector_store.list_documents()),
        }
    )
    try:
        while True:
            data = await websocket.receive_json()
            objective = str(data.get("objective", "")).strip()
            top_k = int(data.get("top_k", 4))
            if len(objective) < 2:
                await websocket.send_json({"type": "error", "message": "Objective must be at least 2 characters."})
                continue

            result = orchestrator.run(objective=objective, top_k=top_k)
            await websocket.send_json({"type": "run_started", "run_id": result["run_id"], "objective": objective})

            for step in result["steps"]:
                await asyncio.sleep(0.14)
                await websocket.send_json({"type": "agent_step", "step": step})

            storage.save_run(
                run_id=result["run_id"],
                objective=result["objective"],
                confidence=result["confidence"],
                duration_ms=result["duration_ms"],
                steps=result["steps"],
                graph=result["graph"],
            )
            await websocket.send_json({"type": "run_completed", "result": result})
    except WebSocketDisconnect:
        return
