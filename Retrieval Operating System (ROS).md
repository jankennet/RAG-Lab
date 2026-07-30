# Retrieval Operating System (ROS)

A modular, production-grade Retrieval-Augmented Generation (RAG) platform designed for experimentation, evaluation, and agentic workflows.

---

## Core Principles

* Storage is independent from retrieval.
* Every stage is replaceable.
* Retrieval is a tool, not the system.
* Everything is measurable.
* Agent decides when and how to retrieve.
* Local-first by default using OPFS.

---

# System Architecture

```text
User
 │
 ▼
Session Manager
 │
 ▼
Planning Agent
 │
 ▼
Retrieval Orchestrator
 │
 ├─ Vector Search
 ├─ BM25 Search
 ├─ Metadata Search
 ├─ Knowledge Graph
 └─ External Tools
 │
 ▼
Candidate Merge
 │
 ▼
Reranker
 │
 ▼
Context Builder
 │
 ▼
Evidence Verification
 │
 ▼
Generation Agent
 │
 ▼
Reflection Agent
 │
 ▼
Final Response
```

---

# Storage Layer

Storage should be abstracted behind a provider.

```ts
interface StorageProvider {
  saveCorpus()
  loadCorpus()

  saveChunks()
  loadChunks()

  saveEmbeddings()
  loadEmbeddings()

  saveIndex()
  loadIndex()
}
```

Initial implementation:

```text
OPFSStorageProvider
```

Future:

```text
IndexedDBStorageProvider
SQLiteStorageProvider
CloudStorageProvider
```

---

# Ingestion Pipeline

```text
Document
   │
   ▼
Loader
   │
   ▼
Parser
   │
   ▼
Cleaner
   │
   ▼
Chunker
   │
   ▼
Embedder
   │
   ▼
Index Builder
   │
   ▼
Storage
```

---

# Retrieval Pipeline

```text
Query
 │
 ▼
Planner
 │
 ▼
Query Expansion
 │
 ▼
Retrievers
 │
 ▼
Merge
 │
 ▼
Reranker
 │
 ▼
Context Builder
 │
 ▼
Generator
```

---

# Components

## Loader

Responsible for importing:

* PDF
* Markdown
* DOCX
* HTML
* TXT

---

## Chunker

Strategies:

* Fixed Size
* Recursive
* Semantic

Interface:

```ts
interface Chunker {
  chunk(document): Chunk[]
}
```

---

## Embedder

Responsible for generating vectors.

Interface:

```ts
interface Embedder {
  embed(text): Promise<number[]>
}
```

Examples:

* OpenAI
* Gemini
* Local Embeddings
* Ollama

---

## Index Builder

Creates:

```text
Vector Index
BM25 Index
Metadata Index
```

---

## Retriever

Interface:

```ts
interface Retriever {
  retrieve(query): Promise<SearchResult[]>
}
```

Implementations:

```text
VectorRetriever
BM25Retriever
HybridRetriever
```

---

## Reranker

Improves retrieval precision.

Interface:

```ts
interface Reranker {
  rerank(query, documents)
}
```

---

## Planner

Determines:

* Is retrieval needed?
* Which retrievers to use?
* Which tools to call?
* Whether another retrieval pass is required?

Output:

```json
{
  "retrieval": true,
  "retrievers": ["vector", "bm25"],
  "iterations": 2
}
```

---

## Context Builder

Responsible for:

* Deduplication
* Compression
* Citation preservation
* Context assembly

---

## Generator

Produces the final answer.

Inputs:

* User query
* Retrieved context
* Memory
* Instructions

---

## Reflection Agent

Post-generation verification.

Checks:

* Completeness
* Missing evidence
* Missing citations
* Hallucinations

Can trigger another retrieval cycle.

---

# Evaluation System

Every pipeline execution should be measurable.

Metrics:

```text
Recall@K
Precision@K
MRR
nDCG
Faithfulness
Answer Relevance
Latency
Token Usage
Cost
```

---

# Observability

Capture every stage.

```text
Run
 ├─ Query
 ├─ Planner Decision
 ├─ Retrieval Results
 ├─ Reranker Scores
 ├─ Context
 ├─ Tokens
 ├─ Cost
 ├─ Latency
 └─ Final Answer
```

---

# OPFS Layout

```text
/
├── corpora/
│   ├── documents/
│   ├── chunks/
│   ├── embeddings/
│   └── metadata/
│
├── indexes/
│   ├── vector/
│   ├── bm25/
│   └── hybrid/
│
├── evaluations/
│   ├── datasets/
│   └── runs/
│
├── pipelines/
│   └── *.json
│
└── cache/
```

---

# Phase Roadmap

## Phase 1

* OPFS storage
* Chunking
* Embeddings
* Vector retrieval

## Phase 2

* BM25
* Hybrid search
* Reranking

## Phase 3

* Planner
* Query expansion
* Agentic retrieval loops

## Phase 4

* Evaluation framework
* Pipeline comparison
* Experiment tracking

## Phase 5

* Reflection agent
* Multi-tool retrieval
* Knowledge graph support

---

# End Goal

A local-first Retrieval Operating System where every retrieval component is modular, measurable, and interchangeable, allowing users to build, compare, and evaluate RAG pipelines rather than merely chat with documents.
