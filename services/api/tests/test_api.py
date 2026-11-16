"""Tests for AetherMind API, SQLite persistence, vector search, and WebSocket streaming."""

from pathlib import Path
import tempfile

from fastapi.testclient import TestClient

# Point tests to an isolated temporary SQLite file before importing app
import os
_TMP_DB = Path(tempfile.gettempdir()) / "aethermind_test.db"
if _TMP_DB.exists():
    _TMP_DB.unlink()
os.environ["DATABASE_PATH"] = str(_TMP_DB)

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health_reports_seeded_documents() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["indexed_documents"] >= 5


def test_vector_search_returns_relevant_match_with_terms() -> None:
    response = client.get("/api/search", params={"q": "vector cosine similarity"})
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) >= 1
    assert results[0]["doc_id"] == "vector-retrieval"
    assert "cosine" in results[0]["matched_terms"]


def test_agent_run_builds_and_persists_4_stage_knowledge_graph() -> None:
    response = client.post(
        "/api/agents/run",
        json={"objective": "Design WebSocket multi-agent graph retrieval", "top_k": 3},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confidence"] >= 50
    assert [step["agent"] for step in data["steps"]] == [
        "Planner",
        "Researcher",
        "Synthesizer",
        "Critic",
    ]
    assert len(data["graph"]["nodes"]) >= 6
    assert len(data["graph"]["edges"]) >= 5

    runs_res = client.get("/api/runs")
    assert runs_res.status_code == 200
    assert any(r["run_id"] == data["run_id"] for r in runs_res.json()["runs"])


def test_document_lifecycle_create_search_and_delete() -> None:
    create = client.post(
        "/api/documents",
        json={
            "doc_id": "custom-crdt-note",
            "title": "Distributed CRDT Spec",
            "content": "Conflict-free replicated data types enable real-time collaborative canvas editing.",
            "tags": ["crdt", "distributed"],
            "category": "Custom",
        },
    )
    assert create.status_code == 201

    search = client.get("/api/search", params={"q": "distributed crdt collaborative"})
    assert search.status_code == 200
    ids = [r["doc_id"] for r in search.json()["results"]]
    assert "custom-crdt-note" in ids

    delete_res = client.delete("/api/documents/custom-crdt-note")
    assert delete_res.status_code == 200


def test_websocket_streams_agent_steps_and_graph() -> None:
    with client.websocket_connect("/ws/workspace") as ws:
        ready = ws.receive_json()
        assert ready["type"] == "ready"

        ws.send_json({"objective": "Optimize hybrid RAG vector retrieval", "top_k": 2})
        events = []
        while True:
            msg = ws.receive_json()
            events.append(msg)
            if msg["type"] == "run_completed":
                break

        types = [e["type"] for e in events]
        assert types[0] == "run_started"
        assert types.count("agent_step") == 4
        assert types[-1] == "run_completed"
