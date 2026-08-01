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
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingestion.csv_processor import SemanticChunk, process_csv, chunk_to_dict
from ingestion.docx_processor import extract_docx
from ingestion.xlsx_processor import extract_xlsx
from ingestion.ocr_processor import extract_ocr_text
from ingestion.sql_processor import extract_sql, extract_sql_metadata
from ingestion.embedder import embed_batch, embed_query
from retrieval.vector_store import VectorStore, SearchResult, StoredChunk, keyword_search

app = FastAPI(
    title="RAG Intelligence Layer",
    description="Smart CSV ingestion + vector retrieval microservice",
    version="0.1.0",
)

# Allow browser fetch from Next.js dev server / production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
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


# ── Extract Text endpoint ──────────────────────────────────────────

class ExtractTextRequest(BaseModel):
    file_path: str
    mime_type: str | None = None
    ocr_lang: str = "eng"
    ocr_dpi: int = 200


class ExtractTextResponse(BaseModel):
    text: str
    title: str
    metadata: dict[str, Any]
    extraction_method: str


@app.post("/extract-text", response_model=ExtractTextResponse)
async def extract_text(req: ExtractTextRequest):
    """Extract text from any supported file format.

    Supported:
      .txt, .md, .html  → direct read
      .csv               → pandas read + pipe-delimited rows
      .json, .jsonl      → pretty-printed
      .docx              → python-docx
      .xlsx, .xls        → pandas read_excel
      .sql               → SQL parser
      .pdf               → OCR if image-based, pdftotext if text layer
      .png, .jpg, ...    → Tesseract OCR
    """
    path = Path(req.file_path)
    if not path.exists():
        raise HTTPException(400, f"File not found: {path}")

    if not path.is_file():
        raise HTTPException(400, f"Not a file: {path}")

    ext = path.suffix.lower()
    mime = (req.mime_type or "").lower()

    try:
        # Direct text
        if ext in (".txt", ".md", ".text", ".rst"):
            raw = path.read_text(encoding="utf-8", errors="replace")
            return ExtractTextResponse(
                text=raw, title=path.stem,
                metadata={"filename": path.name, "file_type": ext},
                extraction_method="direct",
            )

        # CSV (via pandas for smart formatting)
        if ext == ".csv" or "csv" in mime:
            df = pd.read_csv(path, on_bad_lines="skip", nrows=500)
            lines = []
            lines.append(" | ".join(str(c) for c in df.columns))
            for _, row in df.head(200).iterrows():
                lines.append(" | ".join(str(v) for v in row.values))
            text = "\n".join(lines)
            return ExtractTextResponse(
                text=text, title=path.stem,
                metadata={"filename": path.name, "file_type": "csv", "rows": len(df)},
                extraction_method="csv",
            )

        # JSON
        if ext == ".json" or "json" in mime:
            raw = path.read_text(encoding="utf-8", errors="replace")
            return ExtractTextResponse(
                text=raw, title=path.stem,
                metadata={"filename": path.name, "file_type": "json"},
                extraction_method="direct",
            )

        # JSONL
        if ext == ".jsonl":
            raw = path.read_text(encoding="utf-8", errors="replace")
            return ExtractTextResponse(
                text=raw, title=path.stem,
                metadata={"filename": path.name, "file_type": "jsonl"},
                extraction_method="direct",
            )

        # DOCX
        if ext == ".docx":
            result = extract_docx(path)
            return ExtractTextResponse(
                text=result["text"], title=result["title"],
                metadata=result["metadata"],
                extraction_method="docx",
            )

        # XLSX / XLS
        if ext in (".xlsx", ".xls"):
            result = extract_xlsx(path)
            return ExtractTextResponse(
                text=result["text"], title=result["title"],
                metadata=result["metadata"],
                extraction_method="xlsx",
            )

        # SQL
        if ext == ".sql":
            result = extract_sql(path)
            meta = dict(result["metadata"])
            # Optionally enrich with parsed schema
            try:
                schema = extract_sql_metadata(path)
                meta["tables"] = schema.get("tables", [])
                meta["table_count"] = schema.get("table_count", 0)
            except Exception:
                pass
            return ExtractTextResponse(
                text=result["text"], title=result["title"],
                metadata=meta,
                extraction_method="sql",
            )

        # PDF / images → OCR
        if ext in (".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"):
            result = extract_ocr_text(
                path, lang=req.ocr_lang, dpi=req.ocr_dpi,
            )
            return ExtractTextResponse(
                text=result["text"], title=result["title"],
                metadata=result["metadata"],
                extraction_method="ocr",
            )

        # Fallback: try reading as text
        raw = path.read_text(encoding="utf-8", errors="replace")
        if len(raw.strip()) > 0:
            return ExtractTextResponse(
                text=raw, title=path.stem,
                metadata={"filename": path.name, "file_type": ext or "unknown"},
                extraction_method="fallback",
            )

        raise HTTPException(400, f"Unsupported file type: {ext}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Extraction failed for {path.name}: {e}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("RAG_SERVICE_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)