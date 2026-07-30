"""In-memory vector store with cosine-similarity search."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np


@dataclass
class StoredChunk:
    source_key: str
    source_name: str
    source_url: str | None
    title: str
    content: str
    metadata: dict[str, Any]
    chunk_index: int
    embedding: list[float]


@dataclass
class SearchResult:
    chunk: StoredChunk
    score: float


class VectorStore:
    """Simple in-memory vector store with cosine similarity."""

    def __init__(self) -> None:
        self.chunks: list[StoredChunk] = []
        self.embeddings: np.ndarray | None = None
        self._loaded = False

    def load(self, dataset_dir: str) -> int:
        """Load all chunks from a dataset directory (stored by TS ingestion)."""
        path = Path(dataset_dir)
        if not path.exists():
            raise FileNotFoundError(f"Dataset dir not found: {dataset_dir}")

        # Load index
        index_path = path / "index.json"
        if not index_path.exists():
            raise FileNotFoundError(f"No index.json in {dataset_dir}")

        with open(index_path) as f:
            meta = json.load(f)

        # Load all chunk files
        all_chunks: list[StoredChunk] = []
        for chunk_file in sorted(path.glob("chunks_*.json")):
            with open(chunk_file) as f:
                batch = json.load(f)
            for item in batch:
                all_chunks.append(StoredChunk(
                    source_key=item.get("source_key", ""),
                    source_name=item.get("source_name", ""),
                    source_url=item.get("source_url"),
                    title=item.get("title", ""),
                    content=item.get("content", ""),
                    metadata=item.get("metadata", {}),
                    chunk_index=item.get("chunk_index", 0),
                    embedding=item.get("embedding", []),
                ))

        if not all_chunks:
            return 0

        self.chunks = all_chunks
        self.embeddings = np.array([c.embedding for c in all_chunks], dtype=np.float32)
        self._loaded = True
        return len(all_chunks)

    def load_from_json(self, chunks_data: list[dict[str, Any]]) -> int:
        """Load chunks from a list of dicts (from Python ingestion)."""
        all_chunks: list[StoredChunk] = []
        for item in chunks_data:
            all_chunks.append(StoredChunk(
                source_key=item["source_key"],
                source_name=item["source_name"],
                source_url=item.get("source_url"),
                title=item["title"],
                content=item["content"],
                metadata=item.get("metadata", {}),
                chunk_index=item.get("chunk_index", 0),
                embedding=item.get("embedding", []),
            ))

        if not all_chunks:
            return 0

        self.chunks = all_chunks
        self.embeddings = np.array([c.embedding for c in all_chunks], dtype=np.float32)
        self._loaded = True
        return len(all_chunks)

    def search(self, query_embedding: list[float], top_k: int = 10) -> list[SearchResult]:
        """Cosine-similarity search. Returns top_k results."""
        if not self._loaded or self.embeddings is None or len(self.chunks) == 0:
            return []

        q = np.array(query_embedding, dtype=np.float32).reshape(1, -1)

        # Normalize for cosine similarity
        q_norm = q / np.linalg.norm(q, axis=1, keepdims=True)
        emb_norm = self.embeddings / np.linalg.norm(self.embeddings, axis=1, keepdims=True)

        scores = (emb_norm @ q_norm.T).flatten()

        # Top-k
        top_indices = np.argsort(scores)[::-1][:top_k]

        results: list[SearchResult] = []
        for idx in top_indices:
            score = float(scores[idx])
            if score < 0.0:
                continue
            results.append(SearchResult(
                chunk=self.chunks[idx],
                score=score,
            ))

        return results


# ── Simple keyword search (fallback) ────────────────────────────────────

def keyword_search(
    chunks: list[StoredChunk],
    query: str,
    top_k: int = 10,
) -> list[SearchResult]:
    """Fallback keyword search when no embeddings available."""
    query_lower = query.lower()
    query_tokens = {t for t in query_lower.split() if len(t) > 1}

    if not query_tokens:
        return [SearchResult(chunk=c, score=0.0) for c in chunks[:top_k]]

    scored: list[tuple[float, StoredChunk]] = []
    for chunk in chunks:
        content_lower = chunk.content.lower()
        title_lower = chunk.title.lower()
        score = 0.0
        for token in query_tokens:
            score += content_lower.count(token) * 1.0
            score += title_lower.count(token) * 3.0  # title matches weighted
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [SearchResult(chunk=c, score=s / max(s for s, _ in scored[:1] or [(1, None)])) for s, c in scored[:top_k]]