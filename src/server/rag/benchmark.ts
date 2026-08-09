/**
 * RAG benchmark: answer quality + latency.
 * No retrieval-ranking metrics (Precision/Recall/Hit Rate removed).
 *
 * Answer: token F1
 * Speed:  per-row + aggregate latency
 */

import { tokenF1 } from "@/server/rag/metrics";

// ── Answer metric ──────────────────────────────────────────────────

export type AnswerEvalResult = {
  tokenF1: number;
};

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