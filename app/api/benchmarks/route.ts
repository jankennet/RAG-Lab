import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { callLlm } from "@/server/rag/providers";
import { getRuns } from "@/server/benchmarks/store";
import type { BenchmarkRun, BenchmarkMetrics, QuestionResult } from "@/server/benchmarks/store";

export const runtime = "nodejs";

// ── Schema ─────────────────────────────────────────────────────

const documentSchema = z.object({
  id: z.number().optional(),
  sourceKey: z.string().optional(),
  sourceName: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  title: z.string().optional(),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  chunkIndex: z.number().optional(),
});

const runBenchmarkSchema = z.object({
  datasetId: z.string().min(1),
  datasetName: z.string().min(1).default("Unknown"),
  limit: z.coerce.number().int().positive().max(100).default(10),
  documents: z.array(documentSchema).min(1),
  provider: z.enum(["nvidia", "openai", "anthropic"]).default("nvidia"),
  model: z.string().min(1).default("meta/llama-3.3-70b-instruct"),
  apiKey: z.string().optional(),
});

// ── LLM evaluation ────────────────────────────────────────────

async function evaluateGeneration(
  question: string,
  context: string,
  apiKeys: Record<string, { key: string; validated?: boolean } | undefined>,
  provider: string,
  model: string,
): Promise<{ faithfulness: number; answerRelevance: number; contextUtilization: number }> {
  const entry = apiKeys[provider];
  if (!entry?.key) {
    return { faithfulness: 0, answerRelevance: 0, contextUtilization: 0 };
  }

  const prompt = `You are a RAG retrieval evaluator. Given a question and the retrieved context documents, rate the RETRIEVAL quality on three metrics from 0.0 to 1.0.

Return ONLY valid JSON (no markdown, no code fences):
{
  "faithfulness": 0.0-1.0,
  "answerRelevance": 0.0-1.0,
  "contextUtilization": 0.0-1.0
}

Definitions:
- faithfulness: Does the retrieved context contain factually consistent, non-contradictory information that would support a trustworthy answer? 0 = context is contradictory or unreliable, 1 = context is fully consistent and factual.
- answerRelevance: How relevant is the retrieved context to answering the question? 0 = completely off-topic, 1 = perfectly addresses the question.
- contextUtilization: Does the retrieved context contain sufficient information to fully answer the question? 0 = not enough info at all, 1 = completely sufficient to answer fully.

Question: ${question}
Retrieved Context: ${context}`;

  try {
    const response = await callLlm({
      provider: provider as "nvidia" | "openai" | "anthropic",
      model,
      messages: [
        { role: "system", content: "You are a precise RAG evaluation assistant. Output only valid JSON." },
        { role: "user", content: prompt },
      ],
      apiKeys: apiKeys as Record<string, { key: string; validated: boolean }>,
      temperature: 0.1,
      maxTokens: 256,
    });

    const parsed = JSON.parse(response.replace(/```(?:json)?\n?/g, "").trim());
    return {
      faithfulness: clamp(Number(parsed.faithfulness) || 0),
      answerRelevance: clamp(Number(parsed.answerRelevance) || 0),
      contextUtilization: clamp(Number(parsed.contextUtilization) || 0),
    };
  } catch {
    return { faithfulness: 0, answerRelevance: 0, contextUtilization: 0 };
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ── GET: benchmark runs (summary only) ────────────────────────

export async function GET(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    // Remove details from list response to keep it lightweight
    const summary = getRuns().map(({ details, ...rest }) => rest);
    return NextResponse.json({ benchmarks: summary });
  } catch {
    return serverError();
  }
}

// ── POST: run benchmark ───────────────────────────────────────

/** Deterministic shuffle: use first N docs sorted by sourceKey */
function pickQuestions(
  docs: Array<{ sourceKey: string; title: string; content: string }>,
  limit: number,
): Array<{ sourceKey: string; title: string; content: string }> {
  // Sort by sourceKey for determinism — same dataset always picks same questions
  const sorted = [...docs].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  return sorted.slice(0, Math.min(limit, sorted.length));
}

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    const body = runBenchmarkSchema.parse(await request.json());
    const { datasetId, datasetName, limit, documents, provider, model } = body;

    const apiKeys: Record<string, { key: string }> = {};
    if (body.apiKey) apiKeys[body.provider] = { key: body.apiKey };

    // Normalize documents
    const docs = documents.map((d, i) => ({
      sourceKey: d.sourceKey ?? `doc-${i}`,
      sourceName: d.sourceName ?? "",
      title: d.title ?? "",
      content: d.content,
    }));

    // Pick `limit` deterministic docs as questions
    const questions = pickQuestions(docs, limit);

    const results: QuestionResult[] = [];

    for (const q of questions) {
      const t0 = performance.now();

      // Search excluding the question doc itself
      const corpus = docs.filter((d) => d.sourceKey !== q.sourceKey);
      const topK = keywordSearch(corpus, q.title || q.content.slice(0, 200), 5);

      // ── Generation eval (LLM) ──
      const contextText = topK
        .map((d, i) => `[${i + 1}] ${d.title}\n${d.content.slice(0, 500)}`)
        .join("\n\n");

      const gen = await evaluateGeneration(
        q.title || q.content.slice(0, 200),
        contextText,
        apiKeys,
        provider,
        model,
      );

      const elapsed = performance.now() - t0;

      results.push({
        question: q.title || q.content.slice(0, 200),
        reference: q.content, // full content, no truncation
        retrievedCount: topK.length,
        retrievedDocTitles: topK.map((d) => d.title || "(untitled)"),
        latencyMs: elapsed,
        faithfulness: gen.faithfulness,
        answerRelevance: gen.answerRelevance,
        contextUtilization: gen.contextUtilization,
      });
    }

    // Aggregate
    const n = results.length;
    const aggregate = (fn: (r: QuestionResult) => number) =>
      n > 0 ? results.reduce((s, r) => s + fn(r), 0) / n : 0;

    const metrics: BenchmarkMetrics = {
      latencyMs: aggregate((r) => r.latencyMs),
      faithfulness: aggregate((r) => r.faithfulness),
      answerRelevance: aggregate((r) => r.answerRelevance),
      contextUtilization: aggregate((r) => r.contextUtilization),
    };

    const run: BenchmarkRun = {
      id: crypto.randomUUID(),
      datasetId,
      datasetName,
      totalQuestions: n,
      status: "completed",
      createdAt: Date.now(),
      metrics,
      details: results,
    };

    const store = getRuns();
    store.unshift(run);
    if (store.length > 50) store.length = 50;

    return NextResponse.json(run);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    console.error("[benchmarks] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}

// ── Keyword search (used internally) ──────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
}

function countOverlap(text: string, token: string): number {
  let count = 0, pos = 0;
  while (pos < text.length) {
    const idx = text.indexOf(token, pos);
    if (idx === -1) break;
    count++;
    pos = idx + token.length;
  }
  return count;
}

function keywordSearch(
  documents: Array<{ title: string; content: string; sourceKey: string }>,
  query: string,
  topK = 5,
): Array<{ title: string; content: string; sourceKey: string; score: number }> {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return documents.slice(0, topK).map((d) => ({ ...d, score: 0 }));
  }

  const scored = documents.map((doc) => {
    const contentLower = doc.content.toLowerCase();
    const titleLower = (doc.title || "").toLowerCase();
    let score = 0;
    for (const token of tokens) {
      score += countOverlap(titleLower, token) * 3;
      score += countOverlap(contentLower, token);
    }
    return { ...doc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}