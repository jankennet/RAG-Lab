# Multi-Source Agentic RAG Platform

TypeScript starter for a Vercel-hosted agentic RAG system.

Stack:
- Orchestration: LangGraph.js
- Inference: NVIDIA NIM
- Retrieval: Supabase + pgvector
- Benchmarking: Hugging Face Datasets
- Validation: Zod

## What is included

- `app/` Vercel-ready Next.js App Router demo
- `app/api/chat/route.ts` RAG query route
- `scripts/ingest-hf.ts` offline ingestion from Hugging Face Datasets into Supabase
- `scripts/benchmark-hf.ts` benchmark runner over Hugging Face Datasets rows
- `supabase/schema.sql` table, vector index, and similarity function

## Setup

1. Install dependencies.
2. Copy `.env.example` to `.env.local` and fill Supabase plus NIM values.
3. Run `supabase/schema.sql` in your Supabase SQL editor.
4. Ingest dataset rows with `npm run ingest`.
5. Start app with `npm run dev`.

## Environment

Required server variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NIM_BASE_URL`
- `NIM_API_KEY`
- `NIM_CHAT_MODEL`
- `NIM_EMBEDDING_MODEL`
- `NIM_EMBEDDING_DIMENSION`

Dataset variables:
- `HF_DATASET_NAME`
- `HF_DATASET_CONFIG`
- `HF_DATASET_SPLIT`
- `HF_DATASET_LIMIT`
- `HF_INGEST_TITLE_FIELD`
- `HF_INGEST_CONTENT_FIELD`
- `HF_INGEST_ID_FIELD`
- `HF_INGEST_URL_FIELD`
- `HF_INGEST_METADATA_FIELDS`

Benchmark variables:
- `HF_BENCHMARK_QUESTION_FIELD`
- `HF_BENCHMARK_REFERENCE_FIELD`
- `HF_BENCHMARK_LIMIT`

## Notes

- `supabase/schema.sql` uses `vector(1024)`. Keep that in sync with embedding model output size.
- Hugging Face ingestion uses datasets-server rows API, so public datasets with split/config access work best.