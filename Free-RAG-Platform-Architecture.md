# Free RAG Platform Architecture

## Goal

Build a free, developer-friendly RAG experimentation platform using:

-   **Orchestration:** LangGraph.js + Vercel
-   **Inference:** NVIDIA NIM
-   **Knowledge Retrieval:** Supabase + pgvector
-   **Benchmarking:** Hugging Face Datasets
-   **Validation:** Zod

The application should allow anyone to ingest datasets, configure
providers, chat with indexed knowledge, and benchmark retrieval quality.

------------------------------------------------------------------------

# User Journey

``` text
Upload Knowledge
       ↓
Index Dataset
       ↓
Configure Models
       ↓
Chat
       ↓
Inspect Sources
       ↓
Benchmark
```

------------------------------------------------------------------------

# Pages

## `/` --- Chat

-   Conversation-first interface
-   Dataset selector
-   Model indicator
-   Retrieval settings (Top K)
-   Source citations for every response

## `/datasets`

Manage knowledge sources.

Features:

-   Import dataset
-   View indexing status
-   Re-index
-   Delete
-   Dataset details

Supported sources:

-   PDF
-   Website
-   GitHub
-   CSV
-   JSON
-   Markdown
-   Hugging Face Dataset

### Hugging Face Import

Fields:

-   Dataset Name
-   Split
-   Subset
-   Maximum Rows
-   Embedding Model
-   Destination (Supabase)

Pipeline:

``` text
HF Dataset
    ↓
Chunk
    ↓
NVIDIA Embeddings
    ↓
Supabase pgvector
    ↓
Ready
```

## `/benchmarks`

Evaluate retrieval quality.

Metrics:

-   Dataset
-   Questions
-   Average Score
-   Latency
-   Cost

Benchmark details:

-   Question
-   Expected Answer
-   Generated Answer
-   BLEU / ROUGE
-   Retrieved Chunks
-   Latency

## `/settings`

### Providers

-   NVIDIA NIM
-   OpenAI
-   Anthropic

### Embeddings

-   Model
-   Dimensions

### Retrieval

-   Top K
-   Chunk Size
-   Chunk Overlap

### API Keys

Manage provider credentials.

------------------------------------------------------------------------

# Sidebar

``` text
Logo

+ New Chat

Chats

Knowledge
- Datasets
- Benchmarks

Settings
- Models
- API Keys

Docs
GitHub
```

------------------------------------------------------------------------

# Architecture

## Query Flow

``` text
User
 ↓
Next.js UI
 ↓
API Routes
 ↓
LangGraph Workflow
 ↓
Supabase Retrieval
 ↓
NVIDIA NIM
 ↓
Response + Sources
```

## Offline Ingestion

``` text
Hugging Face Dataset
 ↓
Offline Script
 ↓
Chunk
 ↓
Embeddings
 ↓
Supabase pgvector
```

## Benchmark Flow

``` text
Questions
 ↓
LangGraph
 ↓
Answer
 ↓
Evaluation
 ↓
Results
```

------------------------------------------------------------------------

# Folder Structure

``` text
app/
├── page.tsx
├── datasets/
├── benchmarks/
├── settings/
├── components/
├── api/

lib/
├── langgraph/
├── rag/
├── embeddings/
├── providers/
├── supabase/
├── huggingface/
└── schemas/
```

------------------------------------------------------------------------

# Zod Validation

Validate every system boundary.

``` text
UI Form
 ↓
Zod
 ↓
API
 ↓
Zod
 ↓
LangGraph State
 ↓
Zod
 ↓
Supabase
 ↓
Zod
 ↓
Inference Response
 ↓
Zod
```

------------------------------------------------------------------------

# Getting Started

1.  Clone the repository.
2.  Create a free Supabase project.
3.  Obtain a free NVIDIA NIM API key.
4.  Configure `.env.local`.
5.  Run the offline ingestion script.
6.  Start the Vercel/Next.js application.
7.  Chat with your indexed datasets.

------------------------------------------------------------------------

# Design Principles

-   Conversation-first UI
-   No marketing dashboard
-   Dataset-centric workflow
-   Minimal setup
-   Clear source attribution
-   Modular architecture
-   Provider agnostic
