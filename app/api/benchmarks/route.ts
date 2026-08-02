import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { callLlm } from "@/server/rag/providers";
import { tokenF1 } from "@/server/rag/benchmark";

// ── Types (mirrored for API — persistence is client-side OPFS) ──

type CompactQuestionResult = {
  latencyMs: number;
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
  tokenF1: number;
  questionLabel: string;
  retrievalCount: number;
  retrievedDocTitles: string[];
};

type BenchmarkMetrics = {
  latencyMs: number;
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
  tokenF1: number;
};

type BenchmarkRun = {
  id: string;
  datasetId: string;
  datasetName: string;
  provider: string;
  model: string;
  totalQuestions: number;
  status: string;
  createdAt: number;
  metrics: BenchmarkMetrics;
  details: CompactQuestionResult[];
};

export const runtime = "nodejs";

// ── Schema ─────────────────────────────────────────────────────

const documentSchema = z.object({
  sourceKey: z.string().optional(),
  title: z.string().optional(),
  content: z.string(),
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
  apiKeys: Record<string, { key: string }>,
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
- faithfulness: Does the retrieved context contain factually consistent, non-contradictory information? 0 = contradictory/unreliable, 1 = fully consistent/factual.
- answerRelevance: How relevant is the context to answering the question? 0 = off-topic, 1 = perfectly addresses it.
- contextUtilization: Does the context contain sufficient info to fully answer? 0 = none, 1 = completely sufficient.

Question: ${question}
Context: ${context}`;

  try {
    const response = await callLlm({
      provider: provider as "nvidia" | "openai" | "anthropic",
      model,
      messages: [
        { role: "system", content: "Output only valid JSON." },
        { role: "user", content: prompt },
      ],
      apiKeys: apiKeys as Record<string, { key: string }>,
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

/** Generate answer using the selected model + context. Returns answer text. */
async function generateAnswer(
  question: string,
  context: string,
  apiKeys: Record<string, { key: string }>,
  provider: string,
  model: string,
): Promise<string> {
  const entry = apiKeys[provider];
  if (!entry?.key) return "";

  try {
    const answer = await callLlm({
      provider: provider as "nvidia" | "openai" | "anthropic",
      model,
      messages: [
        {
          role: "system",
          content:
            "Answer the question concisely in 1-3 sentences using the context. " +
            "If context lacks info, say 'Not enough context to answer.'",
        },
        {
          role: "user",
          content: `Question: ${question}\n\nContext:\n${context}`,
        },
      ],
      apiKeys: apiKeys as Record<string, { key: string }>,
      temperature: 0.2,
      maxTokens: 512,
    });
    return answer;
  } catch {
    return "";
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ── POST: run benchmark ───────────────────────────────────────

/** Deterministic: sort by sourceKey for stable question selection */
function pickQuestions(
  docs: Array<{ sourceKey: string; title: string; content: string }>,
  limit: number,
): Array<{ sourceKey: string; title: string; content: string }> {
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
      title: d.title ?? "",
      content: d.content,
    }));

    // Pick `limit` docs as questions
    const questions = pickQuestions(docs, limit);
    const corpus = docs;

    const results: CompactQuestionResult[] = [];
    let totalTokenF1 = 0;

    for (const q of questions) {
      const t0 = performance.now();

      // Search excluding the question doc itself
      const topK = keywordSearch(
        corpus.filter((d) => d.sourceKey !== q.sourceKey),
        q.title || q.content.slice(0, 200),
        5,
      );
      const contextText = topK
        .map((d, i) => `[${i + 1}] ${d.title}\n${d.content.slice(0, 500)}`)
        .join("\n\n");

      // ── Parallel: evaluate retrieval + generate answer ──
      const [gen, answer] = await Promise.all([
        evaluateGeneration(
          q.title || q.content.slice(0, 200),
          contextText,
          apiKeys,
          provider,
          model,
        ),
        generateAnswer(
          q.title || q.content.slice(0, 200),
          contextText,
          apiKeys,
          provider,
          model,
        ),
      ]);

      // Token F1 between generated answer and reference content
      const f1 = tokenF1(answer, q.content);
      totalTokenF1 += f1;

      const elapsed = performance.now() - t0;

      results.push({
        questionLabel: (q.title || q.content).slice(0, 80),
        retrievalCount: topK.length,
        retrievedDocTitles: topK.map((d) => d.title || "(untitled)"),
        latencyMs: elapsed,
        faithfulness: gen.faithfulness,
        answerRelevance: gen.answerRelevance,
        contextUtilization: gen.contextUtilization,
        tokenF1: f1,
      });
    }

    // Aggregate
    const n = results.length;
    const aggregate = (fn: (r: CompactQuestionResult) => number) =>
      n > 0 ? results.reduce((s, r) => s + fn(r), 0) / n : 0;

    const metrics: BenchmarkMetrics = {
      latencyMs: aggregate((r) => r.latencyMs),
      faithfulness: aggregate((r) => r.faithfulness),
      answerRelevance: aggregate((r) => r.answerRelevance),
      contextUtilization: aggregate((r) => r.contextUtilization),
      tokenF1: aggregate((r) => r.tokenF1),
    };

    const run: BenchmarkRun = {
      id: crypto.randomUUID(),
      datasetId,
      datasetName,
      provider,
      model,
      totalQuestions: n,
      status: "completed",
      createdAt: Date.now(),
      metrics,
      details: results,
    };

    // Persistence handled client-side (OPFS)
    return NextResponse.json(run);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    console.error("[benchmarks] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}

// ── Keyword search ────────────────────────────────────────────

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