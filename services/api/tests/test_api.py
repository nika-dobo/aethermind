"""Tests for AetherMind API, vector search, and multi-agent orchestrator."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_seeded_documents() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["indexed_documents"] >= 3


def test_vector_search_returns_relevant_match() -> None:
    response = client.get("/api/search", params={"q": "vector cosine similarity"})
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) >= 1
    assert results[0]["doc_id"] == "vector-retrieval"


def test_agent_run_builds_knowledge_graph() -> None:
    response = client.post(
        "/api/agents/run",
        json={"objective": "Design WebSocket multi-agent graph retrieval", "top_k": 2},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["steps"]) == 3
    assert [step["agent"] for step in data["steps"]] == ["Researcher", "Synthesizer", "Critic"]
    assert len(data["graph"]["nodes"]) >= 4
    assert len(data["graph"]["edges"]) >= 3


def test_add_document_and_retrieve() -> None:
    create = client.post(
        "/api/documents",
        json={
            "doc_id": "custom-note",
            "title": "CRDT Sync Spec",
            "content": "Conflict-free replicated data types enable real-time collaborative canvas editing.",
            "tags": ["crdt", "realtime"],
        },
    )
    assert create.status_code == 201

    search = client.get("/api/search", params={"q": "collaborative crdt canvas"})
    assert search.status_code == 200
    ids = [r["doc_id"] for r in search.json()["results"]]
    assert "custom-note" in ids
