"""
Intelligence/Retrieval Layer — Python FastAPI microservice.

Endpoints:
  POST /ingest    — Ingest CSV file, produce semantic chunks + embeddings
  POST /retrieve  — Vector search across ingested datasets
  GET  /health    — Health check

Architecture:
  TS (orchestration) → Python (retrieval) → NIM (embeddings)
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from ingestion.csv_processor import SemanticChunk, process_csv, chunk_to_dict
from ingestion.embedder import embed_batch, embed_query
from retrieval.vector_store import VectorStore, SearchResult, StoredChunk, keyword_search

app = FastAPI(
    title="RAG Intelligence Layer",
    description="Smart CSV ingestion + vector retrieval microservice",
    version="0.1.0",
)

# ── Config ──────────────────────────────────────────────────────────────

DATA_DIR = Path(os.environ.get("RAG_DATA_DIR", str(Path.cwd() / "data" / "datasets")))
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nvidia/nv-embedqa-e5-v5")
EMBED_DIM = int(os.environ.get("EMBED_DIM", "1024"))

# Shared vector store (in-memory, load-on-demand)
_store = VectorStore()


# ── Models ───────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    csv_content: str | None = None
    file_path: str | None = None
    source_name: str | None = None
    max_rows: int | None = 5000
    generate_summaries: bool = True
    api_key: str = ""


class IngestResponse(BaseModel):
    source_name: str
    row_count: int
    chunk_count: int
    column_count: int
    columns: list[dict[str, Any]]
    chunks: list[dict[str, Any]]


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 10
    dataset_dir: str | None = None
    chunks_data: list[dict[str, Any]] | None = None
    use_keyword_fallback: bool = True
    api_key: str = ""


class RetrievedDoc(BaseModel):
    source_key: str
    source_name: str
    title: str
    content: str
    metadata: dict[str, Any]
    similarity: float


class RetrieveResponse(BaseModel):
    results: list[RetrievedDoc]
    total_chunks_searched: int


class HealthResponse(BaseModel):
    status: str
    data_dir_exists: bool
    loaded_chunks: int


# ── Endpoints ───────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        data_dir_exists=DATA_DIR.exists(),
        loaded_chunks=len(_store.chunks),
    )


@app.post("/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest):
    """Ingest CSV → semantic chunks → embeddings → return chunks with vectors."""
    if not req.api_key:
        raise HTTPException(400, "api_key required")

    csv_path = req.file_path
    if req.csv_content:
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False)
        tmp.write(req.csv_content)
        tmp.close()
        csv_path = tmp.name

    if not csv_path or not Path(csv_path).exists():
        raise HTTPException(400, "Provide csv_content or valid file_path")

    try:
        dataset = process_csv(
            csv_path=csv_path,
            source_name=req.source_name,
            max_rows=req.max_rows,
            generate_summaries=req.generate_summaries,
        )

        texts = [c.content for c in dataset.chunks]
        embeddings = await embed_batch(texts, req.api_key, EMBED_MODEL)

        chunk_dicts: list[dict[str, Any]] = []
        for i, chunk in enumerate(dataset.chunks):
            d = chunk_to_dict(chunk)
            d["embedding"] = embeddings[i] if i < len(embeddings) else []
            chunk_dicts.append(d)

        safe_name = dataset.name.replace(" ", "_").replace("/", "_")[:64]
        out_dir = DATA_DIR / safe_name
        out_dir.mkdir(parents=True, exist_ok=True)

        batch_size = 32
        for i in range(0, len(chunk_dicts), batch_size):
            batch = chunk_dicts[i : i + batch_size]
            part = i // batch_size
            (out_dir / f"chunks_{part}.json").write_text(
                json.dumps(batch, default=str), encoding="utf-8"
            )

        meta = {
            "dataset": dataset.name,
            "source": "python-ingest",
            "sourceUrl": csv_path,
            "rowCount": dataset.row_count,
            "chunkCount": len(dataset.chunks),
            "embeddingDim": EMBED_DIM,
            "createdAt": __import__("time").time(),
        }
        (out_dir / "index.json").write_text(json.dumps(meta, indent=2))

        return IngestResponse(
            source_name=dataset.name,
            row_count=dataset.row_count,
            chunk_count=len(dataset.chunks),
            column_count=len(dataset.columns),
            columns=[
                {
                    "name": c.name,
                    "dtype": c.dtype,
                    "unique_ratio": c.unique_ratio,
                    "sample_values": c.sample_values,
                    "min": c.min,
                    "max": c.max,
                    "mean": c.mean,
                }
                for c in dataset.columns
            ],
            chunks=[
                {k: v for k, v in d.items() if k != "embedding"}
                for d in chunk_dicts
            ],
        )
    except Exception as e:
        raise HTTPException(500, f"Ingestion failed: {e}")
    finally:
        if req.csv_content and csv_path:
            Path(csv_path).unlink(missing_ok=True)


@app.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest):
    """Vector search across dataset chunks."""
    if not req.dataset_dir and not req.chunks_data:
        raise HTTPException(400, "Provide dataset_dir or chunks_data")

    total_chunks = 0
    if req.dataset_dir:
        try:
            total_chunks = _store.load(req.dataset_dir)
        except FileNotFoundError:
            raise HTTPException(404, f"Dataset dir not found: {req.dataset_dir}")

    if req.chunks_data:
        total_chunks = _store.load_from_json(req.chunks_data)

    if total_chunks == 0:
        return RetrieveResponse(results=[], total_chunks_searched=0)

    if req.api_key and _store.embeddings is not None and len(_store.embeddings) > 0:
        try:
            q_emb = await embed_query(req.query, req.api_key, EMBED_MODEL)
            results = _store.search(q_emb, top_k=req.top_k)
        except Exception:
            if not req.use_keyword_fallback:
                raise
            stub_chunks = _store.chunks
            results = keyword_search(stub_chunks, req.query, top_k=req.top_k)
    else:
        if not req.use_keyword_fallback:
            return RetrieveResponse(results=[], total_chunks_searched=total_chunks)
        results = keyword_search(_store.chunks, req.query, top_k=req.top_k)

    return RetrieveResponse(
        results=[
            RetrievedDoc(
                source_key=r.chunk.source_key,
                source_name=r.chunk.source_name,
                title=r.chunk.title,
                content=r.chunk.content,
                metadata=r.chunk.metadata,
                similarity=r.score,
            )
            for r in results
        ],
        total_chunks_searched=total_chunks,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("RAG_SERVICE_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)