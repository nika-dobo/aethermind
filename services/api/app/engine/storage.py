"""SQLite persistence layer for AetherMind workspace notes and research briefs."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class StoredDocument:
    """Persisted workspace note."""

    doc_id: str
    title: str
    content: str
    tags: list[str]
    category: str
    created_at: str


@dataclass(frozen=True)
class StoredRun:
    """Persisted multi-agent brief & knowledge map record."""

    run_id: str
    objective: str
    confidence: int
    duration_ms: int
    brief: dict[str, Any]
    steps: list[dict[str, Any]]
    graph: dict[str, Any]
    created_at: str


class WorkspaceStorage:
    """Thread-safe SQLite store for workspace notes and generated briefs."""

    def __init__(self, db_path: str | Path = "aethermind.db") -> None:
        self._db_path = str(db_path)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    doc_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags_json TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'General',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS runs (
                    run_id TEXT PRIMARY KEY,
                    objective TEXT NOT NULL,
                    confidence INTEGER NOT NULL,
                    duration_ms INTEGER NOT NULL,
                    brief_json TEXT NOT NULL DEFAULT '{}',
                    steps_json TEXT NOT NULL,
                    graph_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
            cols = {
                row["name"]
                for row in conn.execute("PRAGMA table_info(runs)").fetchall()
            }
            if "brief_json" not in cols:
                conn.execute(
                    "ALTER TABLE runs ADD COLUMN brief_json TEXT NOT NULL DEFAULT '{}'"
                )

    def upsert_document(
        self,
        doc_id: str,
        title: str,
        content: str,
        tags: list[str],
        category: str = "General",
    ) -> StoredDocument:
        """Insert or update a workspace note."""
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO documents (doc_id, title, content, tags_json, category, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(doc_id) DO UPDATE SET
                    title = excluded.title,
                    content = excluded.content,
                    tags_json = excluded.tags_json,
                    category = excluded.category
                """,
                (doc_id, title, content, json.dumps(tags), category, now),
            )
        return StoredDocument(
            doc_id=doc_id,
            title=title,
            content=content,
            tags=list(tags),
            category=category,
            created_at=now,
        )

    def delete_document(self, doc_id: str) -> bool:
        """Delete a note by ID; returns True if removed."""
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM documents WHERE doc_id = ?", (doc_id,))
            return cur.rowcount > 0

    def replace_all_documents(
        self, items: list[tuple[str, str, str, list[str], str]]
    ) -> list[StoredDocument]:
        """Replace workspace notes with a selected Knowledge Pack."""
        with self._connect() as conn:
            conn.execute("DELETE FROM documents")
        saved: list[StoredDocument] = []
        for doc_id, title, content, tags, category in items:
            saved.append(self.upsert_document(doc_id, title, content, tags, category))
        return saved

    def list_documents(self) -> list[StoredDocument]:
        """Return all persisted notes ordered newest first."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT doc_id, title, content, tags_json, category, created_at FROM documents ORDER BY created_at DESC"
            ).fetchall()
        return [
            StoredDocument(
                doc_id=row["doc_id"],
                title=row["title"],
                content=row["content"],
                tags=json.loads(row["tags_json"]),
                category=row["category"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def save_run(
        self,
        run_id: str,
        objective: str,
        confidence: int,
        duration_ms: int,
        brief: dict[str, Any],
        steps: list[dict[str, Any]],
        graph: dict[str, Any],
    ) -> StoredRun:
        """Persist a completed multi-agent run."""
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO runs (run_id, objective, confidence, duration_ms, brief_json, steps_json, graph_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    objective,
                    confidence,
                    duration_ms,
                    json.dumps(brief),
                    json.dumps(steps),
                    json.dumps(graph),
                    now,
                ),
            )
        return StoredRun(
            run_id=run_id,
            objective=objective,
            confidence=confidence,
            duration_ms=duration_ms,
            brief=brief,
            steps=steps,
            graph=graph,
            created_at=now,
        )

    def list_runs(self, limit: int = 15) -> list[StoredRun]:
        """Return recent multi-agent runs."""
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT run_id, objective, confidence, duration_ms, brief_json, steps_json, graph_json, created_at
                FROM runs
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            StoredRun(
                run_id=row["run_id"],
                objective=row["objective"],
                confidence=row["confidence"],
                duration_ms=row["duration_ms"],
                brief=json.loads(row["brief_json"] or "{}"),
                steps=json.loads(row["steps_json"]),
                graph=json.loads(row["graph_json"]),
                created_at=row["created_at"],
            )
            for row in rows
        ]
