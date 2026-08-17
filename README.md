# RAG Lab 🔬

RAG Lab is a browser-native, local-first evaluation suite and development platform for Agentic RAG (Retrieval-Augmented Generation). Designed for developer observability, it provides automated benchmarking, chunking strategy analysis, and golden dataset generation—giving developers a unified "RAG Accuracy Score" before deployment.

Data stays entirely in your browser using OPFS (Origin Private File System). No remote database is required.

---

## 🏗️ Architecture

RAG Lab uses a modular architecture separating orchestration, storage, and evaluation:

1. **Agentic Orchestration (`src/server/rag/graph.ts`)**
   - Built on **LangGraph.js**, supporting stateful RAG workflows.
   - Interchangeable LLM providers (OpenAI, Anthropic, NVIDIA NIM).
   - Dynamic chunking strategies (fixed-size, semantic, structured).

2. **Developer Observability & Evaluation Suite**
   - **Synthetic Golden Datasets (`src/server/rag/synthetic.ts`)**: Auto-generates high-quality QA pairs based on ingested documents to build a ground-truth dataset.
   - **Matrix Evaluation (`src/server/rag/matrix-eval.ts`)**: Exhaustively tests combinations of chunking strategies, embedding models, and prompts against your datasets.
   - **RAG Accuracy Score (`src/server/rag/score.ts`)**: A weighted, composite metric combining Faithfulness, Relevance, and Completeness to give a clear go/no-go quality signal.
   - **CI/CD Quality Gates (`scripts/eval-gate.ts`)**: Run headless evaluations in your CI/CD pipeline to ensure RAG performance never degrades on new commits.

3. **Local-First Storage (`src/client/opfs.ts`)**
   - Documents, datasets, and configurations are securely stored within the browser's sandbox using OPFS.
   - API keys are encrypted into `httpOnly` cookies via the Next.js backend (`app/api/session/`).

4. **Multi-Format Ingestion Engine**
   - Parses text, DOCX, XLSX, PDFs, and more.
   - Fallback to an optional Python microservice (`python-service/`) for OCR on scanned PDFs and images using Tesseract.

---

## 🚀 Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Rename `.env.example` to `.env` and fill in `SESSION_KEY_SECRET` (used for cookie encryption).
   ```bash
   openssl rand -hex 32 # Generate a 64-char hex string
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open the dashboard at `http://localhost:3000`. Navigate to **Settings** to add your API keys.

---

## 📊 Evaluation & Benchmarking (CI/CD)

RAG Lab exposes CLI tools for automated RAG testing:

**Run the Evaluation Gate (CI/CD Quality Check):**
```bash
tsx scripts/eval-gate.ts --dataset my-golden-dataset
```

**Run Matrix Benchmarks:**
```bash
tsx scripts/benchmark.ts --all-strategies
```
*Benchmarks are saved to `data/benchmarks/` and immediately visualized on the Dashboard Leaderboard (`/compare`).*

---

## 📚 CLI Data Ingestion

You can programmatically ingest data into RAG Lab from local files or HuggingFace:

```bash
# From HuggingFace
tsx scripts/ingest.ts --url https://huggingface.co/datasets/org/name

# From local files
tsx scripts/ingest.ts --file ./data.csv --content-field text --title-field title
tsx scripts/ingest.ts --file ./report.docx
```

---

## 🐍 Python Service (Optional)

Needed **only** for OCR on scanned PDFs and images. Native formats (Text, Markdown, DOCX, XLSX, JSON) are handled entirely within the TypeScript environment.

```bash
cd python-service
pip install -r requirements.txt
python main.py
# Runs on http://127.0.0.1:8001
```
*(Alternatively, run `npm run rag-service`)*

---

## 🛡️ Security

- **No Remote Database**: User files and datasets do not leave the local browser environment (unless sent to your configured LLM API).
- **Secure Key Storage**: API keys are never stored in localStorage. They are managed through secure Next.js API routes and `httpOnly` session cookies using `SESSION_KEY_SECRET`.
