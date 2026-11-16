"""AetherMind FastAPI entrypoint with Knowledge Packs, SQLite persistence, and WebSocket streaming."""

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
    version="0.3.0",
    description="AI Research & Decision Copilot — Turn scattered notes into verified Action Briefs and visual Knowledge Maps.",
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

KNOWLEDGE_PACKS: dict[str, list[tuple[str, str, str, list[str], str]]] = {
    "ai-study": [
        (
            "rag-vs-finetuning",
            "RAG vs Fine-Tuning Guide",
            "Use RAG (Retrieval-Augmented Generation) when facts change frequently or require source citations. Use Fine-Tuning when you need consistent tone, domain formatting, or specialized reasoning patterns.",
            ["rag", "finetuning", "llm", "citations"],
            "AI / ML",
        ),
        (
            "chunking-embeddings",
            "Vector Search & Chunking Rules",
            "Split documents into 300–500 token chunks with 15% overlap so context isn't lost across boundaries. Combine keyword matching (BM25/TF-IDF) with dense embeddings for hybrid retrieval.",
            ["vector", "chunking", "embeddings", "search"],
            "AI / ML",
        ),
        (
            "ml-eval-metrics",
            "Evaluating AI & ML Systems",
            "Track Precision, Recall, and F1-Score for classification tasks, and measure Faithfulness plus Answer Relevance in RAG pipelines to catch hallucinations early.",
            ["evaluation", "metrics", "f1", "hallucination"],
            "Data Science",
        ),
        (
            "agent-guardrails",
            "AI Agent Reliability & Guardrails",
            "Break complex tasks into specialized roles (Planner, Researcher, Fact-Checker) and require source grounding before presenting conclusions to users.",
            ["agents", "reliability", "guardrails", "workflow"],
            "AI / ML",
        ),
    ],
    "startup-launch": [
        (
            "mvp-validation",
            "MVP Scope & User Validation",
            "Ship the smallest workflow that solves one painful problem in under 60 seconds. Talk to 10 target users before building secondary dashboards or billing.",
            ["mvp", "validation", "users", "startup"],
            "Product",
        ),
        (
            "launch-checklist",
            "Product Launch & Onboarding Loop",
            "Provide pre-loaded sample data so first-time visitors experience the core aha-moment immediately without signing up or uploading files first.",
            ["launch", "onboarding", "aha", "growth"],
            "Growth",
        ),
        (
            "pricing-conversion",
            "SaaS Pricing & Conversion Strategy",
            "Keep a generous free tier for solo exploration and gate team collaboration, API limits, or persistent workspaces behind a clear Pro tier.",
            ["pricing", "saas", "conversion", "monetization"],
            "Business",
        ),
        (
            "analytics-retention",
            "Retention & Key Product Metrics",
            "Measure activation rate (first completed task within 3 minutes), Day-7 retention, and export/share actions rather than vanity page views.",
            ["analytics", "retention", "metrics", "kpi"],
            "Growth",
        ),
    ],
    "system-design": [
        (
            "realtime-websockets",
            "WebSockets & Streaming Backpressure",
            "Use WebSockets for multi-step live progress updates, keep messages small, and implement automatic REST or local fallback when connections drop.",
            ["websockets", "realtime", "streaming", "fallback"],
            "Backend",
        ),
        (
            "caching-cdn",
            "Caching Layers & Latency Budget",
            "Cache read-heavy queries at the CDN edge and in memory with short TTLs; reserve SQLite/Postgres writes for durable user state and audit logs.",
            ["caching", "cdn", "latency", "database"],
            "Architecture",
        ),
        (
            "auth-security",
            "API Security & Input Validation",
            "Validate every request schema at the boundary with Pydantic, enforce strict CORS origins, and never expose raw stack traces or secrets in client responses.",
            ["security", "cors", "validation", "api"],
            "Security",
        ),
        (
            "testing-ci",
            "Automated Testing & CI Pipelines",
            "Pair fast unit/API tests in Pytest with frontend typechecking and production builds in GitHub Actions so every commit stays deployable.",
            ["testing", "pytest", "ci", "quality"],
            "DevOps",
        ),
    ],
}


def _sync_vector_index() -> None:
    """Refresh in-memory vector store from SQLite documents."""
    for existing in list(vector_store.list_documents()):
        vector_store.remove(existing.doc_id)
    for doc in storage.list_documents():
        vector_store.add(
            doc_id=doc.doc_id,
            title=doc.title,
            content=doc.content,
            tags=doc.tags,
            category=doc.category,
        )


def _bootstrap_workspace() -> None:
    """Seed AI Study pack on first boot or upgrade stale v0.2 meta-docs."""
    existing = storage.list_documents()
    stale_ids = {"arch-overview", "agent-dag", "vector-retrieval", "ws-backpressure", "crdt-canvas"}
    if not existing or {d.doc_id for d in existing} == stale_ids:
        storage.replace_all_documents(KNOWLEDGE_PACKS["ai-study"])
    _sync_vector_index()


_bootstrap_workspace()


class DocumentIn(BaseModel):
    """Payload for indexing a new workspace note."""

    doc_id: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=20000)
    tags: list[str] = Field(default_factory=list)
    category: str = Field(default="My Notes", min_length=1, max_length=40)


class AgentRunRequest(BaseModel):
    """Payload for triggering a multi-agent brief."""

    objective: str = Field(..., min_length=2, max_length=500)
    top_k: int = Field(default=4, ge=1, le=10)


class PackLoadRequest(BaseModel):
    """Payload for switching starter Knowledge Packs."""

    pack_id: str = Field(..., min_length=1, max_length=40)


@app.get("/health")
def health() -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "aethermind-api",
        "version": "0.3.0",
        "indexed_documents": len(vector_store.list_documents()),
        "saved_runs": len(storage.list_runs(limit=100)),
    }


@app.get("/api/documents")
def list_documents() -> dict[str, Any]:
    """Return all persisted workspace notes."""
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
    """Persist and index a new note into the workspace vector store."""
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


@app.post("/api/packs/load")
def load_pack(payload: PackLoadRequest) -> dict[str, Any]:
    """Load one of the built-in real-world Knowledge Packs."""
    pack = KNOWLEDGE_PACKS.get(payload.pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Unknown knowledge pack")
    saved = storage.replace_all_documents(pack)
    _sync_vector_index()
    return {
        "pack_id": payload.pack_id,
        "documents": [
            {
                "doc_id": d.doc_id,
                "title": d.title,
                "content": d.content,
                "tags": d.tags,
                "category": d.category,
                "created_at": d.created_at,
            }
            for d in saved
        ],
    }


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str) -> dict[str, Any]:
    """Remove a note from both SQLite and the vector index."""
    removed_db = storage.delete_document(doc_id)
    removed_idx = vector_store.remove(doc_id)
    if not (removed_db or removed_idx):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": doc_id}


@app.get("/api/search")
def search_documents(q: str, top_k: int = 5) -> dict[str, Any]:
    """Run hybrid vector similarity search across workspace notes."""
    results = vector_store.search(q, top_k=top_k)
    return {"query": q, "results": [asdict(r) for r in results]}


@app.get("/api/runs")
def list_runs(limit: int = 12) -> dict[str, Any]:
    """Return recent persisted multi-agent briefs."""
    runs = [
        {
            "run_id": r.run_id,
            "objective": r.objective,
            "confidence": r.confidence,
            "duration_ms": r.duration_ms,
            "brief": r.brief,
            "steps": r.steps,
            "graph": r.graph,
            "created_at": r.created_at,
        }
        for r in storage.list_runs(limit=limit)
    ]
    return {"runs": runs}


@app.post("/api/agents/run")
def run_agents(payload: AgentRunRequest) -> dict[str, Any]:
    """Execute the 4-stage AI team, persist run, and return Action Brief + Knowledge Map."""
    result = orchestrator.run(objective=payload.objective, top_k=payload.top_k)
    storage.save_run(
        run_id=result["run_id"],
        objective=result["objective"],
        confidence=result["confidence"],
        duration_ms=result["duration_ms"],
        brief=result["brief"],
        steps=result["steps"],
        graph=result["graph"],
    )
    return result


@app.websocket("/ws/workspace")
async def workspace_socket(websocket: WebSocket) -> None:
    """Stream AI team progress and final Action Brief over WebSocket."""
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
                await websocket.send_json({"type": "error", "message": "Goal must be at least 2 characters."})
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
                brief=result["brief"],
                steps=result["steps"],
                graph=result["graph"],
            )
            await websocket.send_json({"type": "run_completed", "result": result})
    except WebSocketDisconnect:
        return
