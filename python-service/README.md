# Python RAG Service

Optional microservice for **OCR** (image PDFs, scanned docs, images), **DOCX/XLSX parsing**, and **vector search**.

## When you need it

| Format | Needed? | Why |
|--------|---------|-----|
| `.pdf` (scanned/image) | **Required** | Tesseract OCR for image-based PDFs |
| `.pdf` (text layer) | Optional | pdftotext or Python service both work |
| `.png/.jpg/...` (images) | **Required** | Tesseract OCR |
| `.docx` | Not needed | TS handles via mammoth |
| `.xlsx/.xls` | Not needed | TS handles via xlsx |
| `.csv/.json/.txt/.sql` | Not needed | TS handles natively |

## Quick start

```bash
cd python-service

# Install system deps (Ubuntu/Debian)
sudo apt install poppler-utils tesseract-ocr tesseract-ocr-eng

# Install Python deps
pip install -r requirements.txt

# Start server
python main.py
# → http://127.0.0.1:8001
# → /health → {"status": "ok"}
# → /extract-text → POST with file_path

# Or via npm
npm run rag-service
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + chunk count |
| POST | `/extract-text` | Extract text from any format |
| POST | `/ingest` | CSV → semantic chunks + embeddings |
| POST | `/retrieve` | Vector search across datasets |

## Deps

See `requirements.txt`. Key: `pytesseract`, `pdf2image`, `python-docx`, `pandas`, `openpyxl`.

## Config

| Env var | Default | Description |
|---------|---------|-------------|
| `RAG_DATA_DIR` | `./data/datasets` | Dataset storage |
| `EMBED_MODEL` | `nvidia/nv-embedqa-e5-v5` | Embedding model |
| `EMBED_DIM` | `1024` | Embedding dimension |
| `RAG_SERVICE_PORT` | `8001` | Server port |