"""Lightweight in-memory TF-IDF cosine-similarity vector store."""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field


_TOKEN_RE = re.compile(r"[a-zA-Z0-9_]+")


def tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric tokenizer."""
    return _TOKEN_RE.findall(text.lower())


@dataclass(frozen=True)
class IndexedDocument:
    """Stored workspace document with token frequency metadata."""

    doc_id: str
    title: str
    content: str
    tags: tuple[str, ...] = ()
    term_counts: Counter[str] = field(default_factory=Counter)


@dataclass(frozen=True)
class SearchResult:
    """Ranked vector search hit."""

    doc_id: str
    title: str
    score: float
    snippet: str


class LocalVectorStore:
    """TF-IDF cosine similarity store for workspace knowledge retrieval."""

    def __init__(self) -> None:
        self._docs: dict[str, IndexedDocument] = {}

    def add(
        self,
        doc_id: str,
        title: str,
        content: str,
        tags: list[str] | tuple[str, ...] = (),
    ) -> IndexedDocument:
        """Index or replace a document by ID."""
        tokens = tokenize(f"{title} {' '.join(tags)} {content}")
        doc = IndexedDocument(
            doc_id=doc_id,
            title=title,
            content=content,
            tags=tuple(tags),
            term_counts=Counter(tokens),
        )
        self._docs[doc_id] = doc
        return doc

    def list_documents(self) -> list[IndexedDocument]:
        """Return all indexed documents."""
        return list(self._docs.values())

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        """Return top-k documents ranked by TF-IDF cosine similarity."""
        query_tokens = tokenize(query)
        if not query_tokens or not self._docs:
            return []

        n_docs = len(self._docs)
        doc_freq: Counter[str] = Counter()
        for doc in self._docs.values():
            doc_freq.update(doc.term_counts.keys())

        def idf(term: str) -> float:
            return math.log((1.0 + n_docs) / (1.0 + doc_freq.get(term, 0))) + 1.0

        query_counts = Counter(query_tokens)
        query_vec = {t: tf * idf(t) for t, tf in query_counts.items()}
        query_norm = math.sqrt(sum(w * w for w in query_vec.values()))
        if query_norm == 0.0:
            return []

        results: list[SearchResult] = []
        for doc in self._docs.values():
            doc_vec = {t: tf * idf(t) for t, tf in doc.term_counts.items()}
            doc_norm = math.sqrt(sum(w * w for w in doc_vec.values()))
            if doc_norm == 0.0:
                continue

            dot = sum(query_vec[t] * doc_vec.get(t, 0.0) for t in query_vec)
            score = dot / (query_norm * doc_norm)
            if score > 0.0:
                snippet = doc.content[:180] + ("..." if len(doc.content) > 180 else "")
                results.append(
                    SearchResult(
                        doc_id=doc.doc_id,
                        title=doc.title,
                        score=round(score, 4),
                        snippet=snippet,
                    )
                )

        results.sort(key=lambda item: item.score, reverse=True)
        return results[:top_k]
