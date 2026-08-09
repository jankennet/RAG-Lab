import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { getProviderKey } from "@/server/auth/key-cookie";
import { callLlm } from "@/server/rag/providers";
import { keywordSearch, type ScoredDoc } from "@/server/rag/retrieval";
import { tokenF1, exactMatchScore, clamp, answerStatus } from "@/server/rag/metrics";
import { evaluateRetrieval } from "@/server/rag/retrieval-eval";

export const runtime = "nodejs";

// ── Types (mirrored for API — persistence is client-side OPFS) ──

type CompactQuestionResult = {
  question: string;
  groundTruth: string;
  generatedAnswer: string;
  /** Why generation produced no answer (missing API key, LLM call failure). */
  generationError?: string;
  answerStatus: "answered" | "refused" | "empty";
  latencyMs: number;
  // retrieval (deterministic, Layer 2) — present when the question is labeled
  recallAtK: number;
  precisionAtK: number;
  retrievalCount: number;
  retrievedDocTitles: string[];
  // reference-based (deterministic, Layer 3a)
  tokenF1: number;
  exactMatch: number;
  // judged (fixed judge model, Layer 3b)
  faithfulness: number;
  answerRelevance: number;
};

type BenchmarkMetrics = {
  latencyMs: number;
  recallAtK: number;
  precisionAtK: number;
  mrr: number;
  labeledCount: number;
  tokenF1: number;
  exactMatch: number;
  faithfulness: number;
  answerRelevance: number;
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
  // Per-state counts so a 0-quality run is self-diagnosing (0 answered tells a
  // different story than "128 refused" vs "128 empty (no key / LLM failed)").
  answeredCount: number;
  refusedCount: number;
  emptyCount: number;
  errorCount: number;
  details: CompactQuestionResult[];
};

// ── Layer 3b: LLM judge ──────────────────────────────────────────
// Judge with a fixed default model for the provider, never the model
// under test — so scores stay comparable across runs and a model can't
// over-score its own output (self-preference bias). The key comes from
// whatever provider is configured (single-key environment).

const JUDGE_MODEL: Record<"nvidia" | "openai" | "anthropic", string> = {
  nvidia: "meta/llama-3.3-70b-instruct",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
};

async function judgeAnswer(
  question: string,
  context: string,
  generatedAnswer: string,
  apiKeys: Record<string, { key: string }>,
  provider: "nvidia" | "openai" | "anthropic",
): Promise<{ faithfulness: number; answerRelevance: number; refused: boolean }> {
  const status = answerStatus(generatedAnswer);
  if (status === "empty") {
    return { faithfulness: 0, answerRelevance: 0, refused: false };
  }
  // A refusal is grounded by definition (no hallucination → faithful), but it did
  // NOT answer the question. Score relevance 0 so a skipped question can't read as
  // "answer is 100% relevant". Decided deterministically — no judge LLM call needed.
  if (status === "refused") {
    return { faithfulness: 1, answerRelevance: 0, refused: true };
  }

  const entry = apiKeys[provider];
  if (!entry?.key) {
    return { faithfulness: 0, answerRelevance: 0, refused: false };
  }

  const prompt =
    `Rate the GENERATED ANSWER against the retrieved context. ` +
    `Return ONLY valid JSON (no markdown, no code fences):\n` +
    `{"faithfulness": 0.0-1.0, "answerRelevance": 0.0-1.0}\n\n` +
    `Definitions:\n` +
    `- faithfulness: Does the answer only claim facts supported by the context? ` +
    `0 = hallucinated/contradicts context, 1 = fully grounded in context.\n` +
    `- answerRelevance: Does the answer actually address the question? 0 = off-topic, 1 = fully addresses it.\n\n` +
    `Question: ${question}\n\nContext:\n${context}\n\nAnswer:\n${generatedAnswer}`;

  try {
    const response = await callLlm({
      provider,
      model: JUDGE_MODEL[provider],
      messages: [
        { role: "system", content: "Output only valid JSON." },
        { role: "user", content: prompt },
      ],
      apiKeys,
      temperature: 0.1,
      maxTokens: 256,
    });

    const parsed = JSON.parse(response.replace(/```(?:json)?\n?/g, "").trim());
    return {
      faithfulness: clamp(Number(parsed.faithfulness) || 0),
      answerRelevance: clamp(Number(parsed.answerRelevance) || 0),
      refused: false,
    };
  } catch {
    return { faithfulness: 0, answerRelevance: 0, refused: false };
  }
}

// Per-row counters so a 0-quality run tells you WHY: how many actually
// produced an answer vs refused / came back empty / failed on the API key.
const GENERATION_MISSING_KEY = (p: string) =>
  `No API key configured for provider "${p}". Add it in Settings (stored server-side in an httpOnly cookie).`;

async function generateAnswer(
  question: string,
  context: string,
  apiKeys: Record<string, { key: string }>,
  provider: "nvidia" | "openai" | "anthropic",
  model: string,
): Promise<{ answer: string; error?: string }> {
  const entry = apiKeys[provider];
  if (!entry?.key) {
    // Do NOT silently blank — an all-empty run that hid a missing key looked
    // exactly like a broken benchmark (fast, 0% quality, no reason exposed).
    return { answer: "", error: GENERATION_MISSING_KEY(provider) };
  }

  try {
    const answer = await callLlm({
      provider,
      model,
      messages: [
        {
          role: "system",
          content:
            "Answer the question concisely in 1-3 sentences directly from the context. " +
            "Give the answer whenever the context contains the relevant information — " +
            "do not refuse just because the answer is only partially or indirectly stated. " +
            "Refuse only if NO part of the context relates to the question.",
        },
        {
          role: "user",
          content: `Question: ${question}\n\nContext:\n${context}`,
        },
      ],
      apiKeys,
      temperature: 0.2,
      maxTokens: 512,
    });
    return { answer };
  } catch (err) {
    return {
      answer: "",
      error: `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Schema ─────────────────────────────────────────────────────

const questionSchema = z.object({
  question: z.string().min(1),
  groundTruth: z.string().min(1),
  relevantDocIds: z.array(z.string()).optional(),
});

const runBenchmarkSchema = z.object({
  datasetId: z.string().min(1),
  datasetName: z.string().min(1).default("Unknown"),
  questions: z.array(questionSchema).min(1).max(200),
  documents: z.array(z.object({
    sourceKey: z.string().optional(),
    title: z.string().optional(),
    content: z.string(),
  })).min(1),
  topK: z.number().int().min(1).max(100).default(5),
  provider: z.enum(["nvidia", "openai", "anthropic"]).default("nvidia"),
  model: z.string().min(1).default("meta/llama-3.3-70b-instruct"),
});

// ── POST: run benchmark ───────────────────────────────────────

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    const body = runBenchmarkSchema.parse(await request.json());
    const { datasetId, datasetName, questions, documents, provider, model, topK } = body;

    const rawKey = await getProviderKey(provider);
    const apiKeys: Record<string, { key: string }> = {};
    if (rawKey) apiKeys[provider] = { key: rawKey };

    const corpus = documents.map((d, i) => ({
      sourceKey: d.sourceKey ?? `doc-${i}`,
      title: d.title ?? "",
      content: d.content,
    }));

    // Layer 2 — deterministic retrieval metrics over the same corpus.
    const retrievalEval = evaluateRetrieval(
      questions.map((q, i) => ({ id: `q-${i}`, question: q.question, relevantDocIds: q.relevantDocIds })),
      corpus,
      topK,
    );
    const retrievalById = new Map(retrievalEval.perQuestion.map((r) => [r.questionId, r]));

    const results: CompactQuestionResult[] = [];
    const total = questions.length;

    // Layered: run each question through search → generate → judge. Questions are
    // independent, so process them in bounded batches to cut wall-clock time while
    // keeping a sane per-burst load on the provider. Results stay ordered.
    const runQuestion = async (i: number): Promise<CompactQuestionResult> => {
      const q = questions[i];
      const t0 = performance.now();

      const topDocs: ScoredDoc[] = keywordSearch(corpus, q.question, topK);
      const contextText = topDocs
        .map((d, j) => `[${j + 1}] ${d.title}\n${d.content}`)
        .join("\n\n");

      // Generate the answer first — the judge (L3b) scores the real answer.
      const { answer, error } = await generateAnswer(q.question, contextText, apiKeys, provider, model);
      const judged = await judgeAnswer(q.question, contextText, answer, apiKeys, provider);

      const retrieved = retrievalById.get(`q-${i}`);
      const status = answerStatus(answer);

      return {
        question: q.question,
        groundTruth: q.groundTruth,
        generatedAnswer: answer,
        generationError: error,
        answerStatus: status,
        latencyMs: performance.now() - t0,
        recallAtK: retrieved?.recall ?? Number.NaN,
        precisionAtK: retrieved?.precision ?? 0,
        retrievalCount: topDocs.length,
        retrievedDocTitles: topDocs.map((d) => d.title || "(untitled)"),
        // Reference metrics mirror the quality philosophy: a refusal/empty answer
        // is a coverage failure, not a partial credit. Zeroing tokenF1 keeps a
        // skipped question from scoring ~35% overlap with the ground truth and
        // polluting the run average.
        tokenF1: status === "answered" ? tokenF1(answer, q.groundTruth) : 0,
        exactMatch: exactMatchScore(answer, q.groundTruth),
        faithfulness: judged.faithfulness,
        answerRelevance: judged.answerRelevance,
      };
    };

    const emit = (obj: unknown) => JSON.stringify(obj) + "\n";
    const BATCH = 3;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < total; i += BATCH) {
            const batch = await Promise.all(
              Array.from({ length: Math.min(BATCH, total - i) }, (_, k) => runQuestion(i + k)),
            );
            results.push(...batch);

            // Progress: one line per completed batch.
            controller.enqueue(
              encoder.encode(emit({ type: "progress", done: results.length, total })),
            );
          }
          controller.enqueue(encoder.encode(emit({ type: "run", run: buildRun() })));
        } catch (err) {
          controller.enqueue(
            encoder.encode(emit({ type: "error", error: err instanceof Error ? err.message : "Benchmark failed" })),
          );
        } finally {
          controller.close();
        }
      },
    });

    // Aggregate: judged/reference metrics average over all rows; retrieval
    // metrics average over labeled rows only (unlabeled → NaN, excluded).
    const buildRun = (): BenchmarkRun => {
      const n = results.length;
      const avg = (fn: (r: CompactQuestionResult) => number) =>
        n > 0 ? results.reduce((s, r) => s + fn(r), 0) / n : 0;
      const avgLabeled = (fn: (r: CompactQuestionResult) => number) => {
        const valid = results.map(fn).filter((x) => !Number.isNaN(x));
        return valid.length ? valid.reduce((s, x) => s + x, 0) / valid.length : 0;
      };
      // Quality metrics (faithfulness/relevance) only make sense over answers that
      // were actually produced. Skipped/refused/empty questions don't demonstrate
      // quality — exclude them, or an all-skipped run would read as 100%.
      const answered = results.filter((r) => r.answerStatus === "answered");
      const avgAnswered = (fn: (r: CompactQuestionResult) => number) =>
        answered.length > 0 ? answered.reduce((s, r) => s + fn(r), 0) / answered.length : 0;

      const metrics: BenchmarkMetrics = {
        latencyMs: avg((r) => r.latencyMs),
        recallAtK: avgLabeled((r) => r.recallAtK),
        precisionAtK: avgLabeled((r) => r.precisionAtK),
        mrr: retrievalEval.mrr,
        labeledCount: retrievalEval.labeledCount,
        tokenF1: avg((r) => r.tokenF1),
        exactMatch: avg((r) => r.exactMatch),
        faithfulness: avgAnswered((r) => r.faithfulness),
        answerRelevance: avgAnswered((r) => r.answerRelevance),
      };

      return {
        id: crypto.randomUUID(),
        datasetId,
        datasetName,
        provider,
        model,
        totalQuestions: results.length,
        answeredCount: results.filter((r) => r.answerStatus === "answered").length,
        refusedCount: results.filter((r) => r.answerStatus === "refused").length,
        emptyCount: results.filter((r) => r.answerStatus === "empty").length,
        errorCount: results.filter((r) => Boolean(r.generationError)).length,
        status: "completed",
        createdAt: Date.now(),
        metrics,
        details: results,
      };
    };

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store, no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    console.error("[benchmarks] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}