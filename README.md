# Multi-Source Agentic RAG Platform

Local-first RAG system. Data stays in your browser (OPFS). API keys in localStorage. No server DB.

**Stack:**
- Orchestration: LangGraph.js
- Inference: NVIDIA NIM / OpenAI / Anthropic
- Storage: OPFS (Origin Private File System)
- Chunking: Strategy-pattern chunker (fixed, recursive, structured)
- Validation: Zod

## What is included

- `app/` Next.js App Router dashboard
- `app/api/chat/` RAG query endpoint
- `app/api/session/` API key validation
- `app/api/datasets/` Hugging Face dataset import
- `app/api/upload/` PDF parsing
- `app/api/benchmarks/` RAG quality evaluation
- `app/api/models/` Model listing
- `scripts/ingest.ts` CLI dataset ingestion
- `scripts/benchmark.ts` CLI benchmark runner
- `python-service/` Optional Python microservice for vector retrieval

## Setup

1. `npm install`
2. `npm run dev`
3. Open app. Go to Settings → add API key(s).

## CLI Ingestion

```bash
# From HuggingFace
tsx scripts/ingest.ts --url https://huggingface.co/datasets/org/name

# From local file
tsx scripts/ingest.ts --file ./data.csv --content-field text --title-field title
```

## Notes

- All data stored in OPFS (browser storage). No server-side persistence.
- API keys stored in localStorage, sent to API per-request.
- PDFs parsed server-side via pdf-parse. All other files parsed client-side.
- Optional Python microservice for vector search (see `python-service/`).