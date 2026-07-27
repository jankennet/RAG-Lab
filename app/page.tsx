"use client";

import { useMemo, useState } from "react";
import type { ChatResponse } from "@/lib/types";

const starterPrompts = [
  "What is the fastest way to bootstrap ingestion from Hugging Face into Supabase?",
  "How should I wire NVIDIA NIM into LangGraph.js for a retrieval answer flow?",
  "What does the Supabase pgvector schema need for similarity search?"
];

export default function HomePage() {
  const [question, setQuestion] = useState(starterPrompts[0]);
  const [topK, setTopK] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatResponse | null>(null);

  const sourceCount = result?.documents.length ?? 0;

  const promptButtons = useMemo(
    () =>
      starterPrompts.map((prompt) => (
        <button key={prompt} className="chip" type="button" onClick={() => setQuestion(prompt)}>
          {prompt}
        </button>
      )),
    []
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ question, topK })
      });

      const payload = (await response.json()) as ChatResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }

      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <div className="page">
        <section className="hero">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Multi-Source Agentic RAG Platform
            </div>
            <h1 className="title">Build, ingest, retrieve, test.</h1>
            <p className="subtitle">
              TypeScript starter for LangGraph.js orchestration, NVIDIA NIM inference, Supabase pgvector retrieval, and Hugging Face Datasets ingestion plus benchmarking. This page exercises full RAG path in Vercel-friendly app.
            </p>
          </div>

          <div className="stack">
            <div className="stat-card">
              <span className="stat-label">Flow</span>
              <span className="stat-value">HF Datasets ingestion, Supabase vector search, NIM answer, Zod validation</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Test mode</span>
              <span className="stat-value">Route: /api/chat · Sources: {sourceCount} · Top K: {topK}</span>
            </div>
          </div>
        </section>

        <section className="grid">
          <article className="panel split">
            <div>
              <h2>What ships here</h2>
              <ul className="flow">
                <li>
                  <strong>Offline ingestion</strong>
                  Pull rows from Hugging Face Datasets API, chunk them, embed with NIM, push into Supabase pgvector.
                </li>
                <li>
                  <strong>Orchestrated query path</strong>
                  LangGraph.js runs retrieval then answer generation, no ad hoc glue.
                </li>
                <li>
                  <strong>Benchmark hook</strong>
                  HF dataset rows feed eval script for question-answer runs and simple overlap scoring.
                </li>
              </ul>
            </div>

            <div>
              <h2>Why this shape</h2>
              <p>
                One app for demo, one ingestion script for data, one benchmark script for evaluation. Small surface, clear path to production.
              </p>
            </div>
          </article>

          <article className="panel playground">
            <div>
              <h2>Try it now</h2>
              <p className="helper">Type question, change top K, submit. If env or Supabase missing, route returns error fast.</p>
            </div>

            <div className="toolbar">{promptButtons}</div>

            <form className="prompt-form" onSubmit={handleSubmit}>
              <textarea className="textarea" value={question} onChange={(event) => setQuestion(event.target.value)} />
              <div className="row">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={8}
                  value={topK}
                  onChange={(event) => setTopK(Number(event.target.value))}
                />
                <button className="button" type="submit" disabled={loading}>
                  {loading ? "Running..." : "Run RAG"}
                </button>
              </div>
            </form>

            {error ? <div className="answer">Error: {error}</div> : null}

            {result ? (
              <>
                <div className="answer">{result.answer}</div>
                <div className="sources">
                  {result.documents.map((document, index) => (
                    <div key={`${document.id}-${document.chunkIndex}`} className="source">
                      <div className="source-top">
                        <div className="source-title">
                          [{index + 1}] {document.title}
                        </div>
                        <div className="source-score">{document.similarity?.toFixed(3) ?? "n/a"}</div>
                      </div>
                      <div className="source-meta">{document.sourceName}</div>
                      <div className="helper">
                        {document.content.slice(0, 220)}{document.content.length > 220 ? "..." : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </article>
        </section>
      </div>
    </main>
  );
}