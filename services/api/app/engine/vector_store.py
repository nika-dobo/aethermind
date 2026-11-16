"""Hybrid TF-IDF cosine-similarity vector store with tag boosting and highlights."""

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
    category: str = "General"
    term_counts: Counter[str] = field(default_factory=Counter)


@dataclass(frozen=True)
class SearchResult:
    """Ranked vector search hit."""

    doc_id: str
    title: str
    category: str
    tags: list[str]
    score: float
    matched_terms: list[str]
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
        category: str = "General",
    ) -> IndexedDocument:
        """Index or replace a document by ID."""
        # Repeat title & tags lightly so structural metadata carries higher retrieval weight.
        weighted_text = f"{title} {title} {' '.join(tags)} {' '.join(tags)} {category} {content}"
        tokens = tokenize(weighted_text)
        doc = IndexedDocument(
            doc_id=doc_id,
            title=title,
            content=content,
            tags=tuple(tags),
            category=category,
            term_counts=Counter(tokens),
        )
        self._docs[doc_id] = doc
        return doc

    def remove(self, doc_id: str) -> bool:
        """Remove a document from the in-memory index."""
        return self._docs.pop(doc_id, None) is not None

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

            matched = [t for t in query_vec if t in doc.term_counts]
            if not matched:
                continue

            dot = sum(query_vec[t] * doc_vec[t] for t in matched)
            score = min(1.0, dot / (query_norm * doc_norm))
            snippet = doc.content[:200] + ("..." if len(doc.content) > 200 else "")
            results.append(
                SearchResult(
                    doc_id=doc.doc_id,
                    title=doc.title,
                    category=doc.category,
                    tags=list(doc.tags),
                    score=round(score, 4),
                    matched_terms=sorted(set(matched)),
                    snippet=snippet,
                )
            )

        results.sort(key=lambda item: item.score, reverse=True)
        return results[:top_k]
