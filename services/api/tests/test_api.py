"""Tests for AetherMind API, Knowledge Packs, Action Briefs, and WebSocket streaming."""

import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

_TMP_DB = Path(tempfile.gettempdir()) / "aethermind_test_v3.db"
if _TMP_DB.exists():
    _TMP_DB.unlink()
os.environ["DATABASE_PATH"] = str(_TMP_DB)

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health_reports_seeded_notes() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["indexed_documents"] >= 4


def test_vector_search_returns_relevant_study_note() -> None:
    response = client.get("/api/search", params={"q": "rag fine tuning citations"})
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) >= 1
    assert results[0]["doc_id"] == "rag-vs-finetuning"
    assert "rag" in results[0]["matched_terms"]


def test_agent_run_returns_action_brief_and_knowledge_map() -> None:
    response = client.post(
        "/api/agents/run",
        json={"objective": "Compare RAG vs Fine-Tuning for my AI project", "top_k": 3},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confidence"] >= 50
    assert [step["agent"] for step in data["steps"]] == [
        "Strategist",
        "Researcher",
        "Writer",
        "Fact-Checker",
    ]
    assert "executive_summary" in data["brief"]
    assert len(data["brief"]["action_plan"]) >= 3
    assert len(data["brief"]["citations"]) >= 1
    assert len(data["graph"]["nodes"]) >= 6

    runs_res = client.get("/api/runs")
    assert runs_res.status_code == 200
    assert any(r["run_id"] == data["run_id"] for r in runs_res.json()["runs"])


def test_knowledge_pack_switch_and_custom_note_lifecycle() -> None:
    pack_res = client.post("/api/packs/load", json={"pack_id": "startup-launch"})
    assert pack_res.status_code == 200
    assert len(pack_res.json()["documents"]) == 4

    create = client.post(
        "/api/documents",
        json={
            "doc_id": "custom-interview-note",
            "title": "Customer Discovery Script",
            "content": "Ask users about their current manual workaround before pitching features.",
            "tags": ["discovery", "interview"],
            "category": "My Notes",
        },
    )
    assert create.status_code == 201

    search = client.get("/api/search", params={"q": "manual workaround customer discovery"})
    assert search.status_code == 200
    assert "custom-interview-note" in [r["doc_id"] for r in search.json()["results"]]

    delete_res = client.delete("/api/documents/custom-interview-note")
    assert delete_res.status_code == 200


def test_websocket_streams_4_stages_and_brief() -> None:
    with client.websocket_connect("/ws/workspace") as ws:
        ready = ws.receive_json()
        assert ready["type"] == "ready"

        ws.send_json({"objective": "Plan MVP launch checklist and retention metrics", "top_k": 3})
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
        assert "action_plan" in events[-1]["result"]["brief"]
