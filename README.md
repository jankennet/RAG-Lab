# RAG LAB

Browser-native, local-first RAG lab. Data stays in your browser (OPFS). No server DB.

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
- `app/api/upload/` Multi-format file parsing (text, DOCX, XLSX, PDF, images)
- `app/api/benchmarks/` RAG quality evaluation
- `app/api/models/` Model listing
- `app/api/ranking/` Model comparison (by dataset × model)
- `app/(dashboard)/compare/` Compare UI with local trends
- `scripts/ingest.ts` CLI dataset ingestion (all formats)
- `scripts/benchmark.ts` CLI benchmark runner
- `python-service/` Optional Python microservice (OCR, vector search)

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
tsx scripts/ingest.ts --file ./report.docx
tsx scripts/ingest.ts --file ./spreadsheet.xlsx
```

## Python Service (Optional — needed for OCR)

Required for scanned PDFs and images. Not needed for DOCX, XLSX, text formats.

See [`python-service/README.md`](python-service/README.md).

```bash
cd python-service
pip install -r requirements.txt
python main.py
# → http://127.0.0.1:8001
```

Or: `npm run rag-service`

## File Format Support

| Format | TS Server | Python Service | Notes |
|--------|-----------|----------------|-------|
| .txt, .md, .html | ✅ Native | ✅ | Direct text |
| .csv | ✅ Native | ✅ pandas | |
| .json, .jsonl | ✅ Native | ✅ | |
| .sql | ✅ Text | ✅ SQL parser | Statement splitting |
| .docx | ✅ mammoth | ✅ python-docx | |
| .xlsx, .xls | ✅ xlsx | ✅ pandas+openpyxl | |
| .pdf (text layer) | ⚠️ pdftotext | ✅ | TS via CLI tool |
| .pdf (scanned) | ❌ | ✅ Tesseract | **Requires Python** |
| .png, .jpg, ... | ❌ | ✅ Tesseract | **Requires Python** |

## Notes

- All data stored in OPFS (browser storage).
- Text formats parsed client-side. Binary formats sent to server.
- Image PDFs/images require Python service with Tesseract.
- Benchmarks persist to `data/benchmarks/` as compact JSON (~2-5KB per run).
- Compare page at `/compare` compares models by F1, latency, faithfulness, and run trends.
