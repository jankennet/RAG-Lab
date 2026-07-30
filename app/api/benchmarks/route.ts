import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { getSessionApiKeys } from "@/server/auth/session";
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
});

// ── Token helpers ──────────────────────────────────────────────

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

/** Jaccard similarity between two word sets */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// ── Server-side keyword search ────────────────────────────────

function searchDocs(
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

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    const body = runBenchmarkSchema.parse(await request.json());
    const { datasetId, datasetName, limit, documents, provider, model } = body;

    const apiKeys = await getSessionApiKeys();

    // Normalize documents
    const docs = documents.map((d, i) => ({
      sourceKey: d.sourceKey ?? `doc-${i}`,
      sourceName: d.sourceName ?? "",
      title: d.title ?? "",
      content: d.content,
    }));

    // Pick `limit` random docs as questions
    const shuffled = [...docs].sort(() => Math.random() - 0.5);
    const questions = shuffled.slice(0, Math.min(limit, shuffled.length));

    const results: QuestionResult[] = [];

    for (const q of questions) {
      // ── Retrieval eval ──
      // Ground truth relevant docs: those with content similar to the answer
      const relevantSet = docs.filter(
        (d) => d.sourceKey !== q.sourceKey && jaccardSimilarity(d.content, q.content) > 0.2,
      );
      const totalRelevant = relevantSet.length;

      // Search excluding the question doc itself
      const corpus = docs.filter((d) => d.sourceKey !== q.sourceKey);
      const topK = searchDocs(corpus, q.title || q.content.slice(0, 200), 5);

      const relevantSourceKeys = new Set(relevantSet.map((d) => d.sourceKey));
      const relevantInTopK = topK.filter((d) => relevantSourceKeys.has(d.sourceKey)).length;

      const recallAtK = totalRelevant > 0 ? relevantInTopK / totalRelevant : 0;
      const precisionAtK = relevantInTopK / Math.max(topK.length, 1);
      const hitRateAtK = relevantInTopK > 0 ? 1 : 0;

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

      results.push({
        question: q.title || q.content.slice(0, 200),
        reference: q.content.slice(0, 300),
        retrievedCount: topK.length,
        relevantInTopK,
        totalRelevant,
        recallAtK,
        precisionAtK,
        hitRateAtK,
        retrievedDocTitles: topK.map((d) => d.title || "(untitled)"),
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
      recallAtK: aggregate((r) => r.recallAtK),
      precisionAtK: aggregate((r) => r.precisionAtK),
      hitRateAtK: aggregate((r) => r.hitRateAtK),
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