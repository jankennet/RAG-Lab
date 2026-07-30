/**
 * RAG benchmark: answer quality + latency.
 * No retrieval-ranking metrics (Precision/Recall/Hit Rate removed).
 *
 * Answer: token F1
 * Speed:  per-row + aggregate latency
 */

// ── Normalization ───────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

// ── Token overlap helpers ──────────────────────────────────────────

function countOverlap(predTokens: string[], refTokens: string[]): number {
  const predCounts = new Map<string, number>();
  const refCounts = new Map<string, number>();

  for (const t of predTokens) predCounts.set(t, (predCounts.get(t) ?? 0) + 1);
  for (const t of refTokens)  refCounts.set(t, (refCounts.get(t) ?? 0) + 1);

  let overlap = 0;
  for (const [t, c] of predCounts) {
    overlap += Math.min(c, refCounts.get(t) ?? 0);
  }
  return overlap;
}

// ── Answer metric ──────────────────────────────────────────────────

export function tokenF1(prediction: string, reference: string): number {
  const pTokens = tokens(prediction);
  const rTokens = tokens(reference);

  if (pTokens.length === 0 || rTokens.length === 0) return 0;

  const overlap = countOverlap(pTokens, rTokens);
  const precision = overlap / pTokens.length;
  const recall = overlap / rTokens.length;

  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

// ── Types ──────────────────────────────────────────────────────────

export interface AnswerEvalResult {
  tokenF1: number;
}

export interface EvalRow {
  question: string;
  reference: string;
  prediction: string;
  answerScore: number;
  latencyMs: number;
}

export interface BenchmarkReport {
  dataset: string;
  scoredRows: number;
  answer: AnswerEvalResult;
  latencyMs: { avg: number; total: number };
  rows: EvalRow[];
}

// ── Benchmark runner ───────────────────────────────────────────────

/**
 * Run benchmark: compare predictions to references.
 *
 * @param dataset  — name for the report
 * @param rows     — { question, reference }[]
 * @param ask      — async function: (question) => { answer, retrievedIds[] }
 */
export async function runBenchmark(
  dataset: string,
  rows: Array<{
    question: string;
    reference: string;
  }>,
  ask: (question: string) => Promise<{
    answer: string;
  }>,
): Promise<BenchmarkReport> {
  const startWall = performance.now();
  const evalRows: EvalRow[] = [];
  let totalF1 = 0;
  let scoredRows = 0;

  for (const row of rows) {
    const t0 = performance.now();
    const { answer } = await ask(row.question);
    const elapsed = performance.now() - t0;
    const f1 = tokenF1(answer, row.reference);

    totalF1 += f1;
    scoredRows++;

    evalRows.push({
      question: row.question,
      reference: row.reference,
      prediction: answer,
      answerScore: f1,
      latencyMs: elapsed,
    });
  }

  const totalMs = performance.now() - startWall;

  return {
    dataset,
    scoredRows,
    answer: { tokenF1: scoredRows > 0 ? totalF1 / scoredRows : 0 },
    latencyMs: { avg: totalMs / scoredRows, total: totalMs },
    rows: evalRows,
  };
}