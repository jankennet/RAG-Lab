/**
 * Multi-metric RAG benchmark.
 *
 * Ranking metrics: precision@K, recall@K, MRR, nDCG
 * Answer metrics:  token F1
 *
 * All functions are pure — no side effects.
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

// ── Ranking metrics ────────────────────────────────────────────────

/**
 * Precision@K: fraction of retrieved docs that are relevant.
 */
export function precisionAtK(
  relevant: Set<string>,
  retrieved: string[],
  k: number,
): number {
  const topK = retrieved.slice(0, k);
  if (topK.length === 0) return 0;
  const hits = topK.filter((id) => relevant.has(id)).length;
  return hits / topK.length;
}

/**
 * Recall@K: fraction of relevant docs that were retrieved.
 */
export function recallAtK(
  relevant: Set<string>,
  retrieved: string[],
  k: number,
): number {
  if (relevant.size === 0) return 0;
  const topK = retrieved.slice(0, k);
  const hits = topK.filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
}

/**
 * Mean Reciprocal Rank: 1 / rank of first relevant doc, 0 if none.
 */
export function reciprocalRank(
  relevant: Set<string>,
  retrieved: string[],
): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.has(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
}

export function mrr(relevant: Set<string>, retrieved: string[]): number {
  return reciprocalRank(relevant, retrieved);
}

/**
 * Discounted Cumulative Gain at K.
 */
export function dcgAtK(
  relevances: number[],
  k: number,
): number {
  const topK = relevances.slice(0, k);
  return topK.reduce((sum, rel, i) => {
    return sum + rel / Math.log2(i + 2); // i+2 because log2(1)=0
  }, 0);
}

/**
 * nDCG@K: DCG / ideal DCG.
 * `relevances` is ordered array of relevance scores (same order as retrieved docs).
 */
export function ndcgAtK(
  relevances: number[],
  k: number,
): number {
  const dcg = dcgAtK(relevances, k);
  const sorted = [...relevances].sort((a, b) => b - a);
  const idcg = dcgAtK(sorted, k);
  return idcg === 0 ? 0 : dcg / idcg;
}

// ── Batch evaluation ───────────────────────────────────────────────

export interface RetrievalEvalResult {
  precisionAtK: number[];
  recallAtK: number[];
  mrr: number;
  ndcg: number;
}

export interface AnswerEvalResult {
  tokenF1: number;
}

export interface EvalRow {
  question: string;
  reference: string;
  prediction: string;
  answerScore: number;
  retrieval?: RetrievalEvalResult;
}

export interface BenchmarkReport {
  dataset: string;
  scoredRows: number;
  retrieval: RetrievalEvalResult | null;
  answer: AnswerEvalResult;
  latencyMs: { avg: number; total: number };
  rows: EvalRow[];
}

/**
 * Evaluate a single retrieval result against known relevant doc IDs.
 * `relevantIds` — set of known-relevant source keys.
 * `retrievedIds` — ordered list of retrieved source keys.
 * `kValues` — which K values to compute (default [1, 3, 5, 10]).
 */
export function evaluateRetrieval(
  relevantIds: Set<string>,
  retrievedIds: string[],
  kValues: number[] = [1, 3, 5, 10],
): RetrievalEvalResult {
  const validKs = kValues.filter((k) => k > 0);

  // Build relevance vector for nDCG (binary: 1 if relevant)
  const relevances = retrievedIds.map((id) => (relevantIds.has(id) ? 1 : 0));

  return {
    precisionAtK: validKs.map((k) => precisionAtK(relevantIds, retrievedIds, k)),
    recallAtK:    validKs.map((k) => recallAtK(relevantIds, retrievedIds, k)),
    mrr:          mrr(relevantIds, retrievedIds),
    ndcg:         ndcgAtK(relevances, Math.max(...validKs)),
  };
}

/**
 * Full benchmark: compare predictions to references, compute all metrics.
 *
 * @param dataset  — name for the report
 * @param rows     — { question, reference, relevantIds? }[]
 * @param ask      — async function: (question) => { answer, retrievedIds[] }
 * @param kValues  — which K to report
 */
export async function runBenchmark(
  dataset: string,
  rows: Array<{
    question: string;
    reference: string;
    relevantIds?: Set<string>;
  }>,
  ask: (question: string) => Promise<{
    answer: string;
    retrievedIds: string[];
  }>,
  kValues: number[] = [1, 3, 5, 10],
): Promise<BenchmarkReport> {
  const startWall = performance.now();
  const evalRows: EvalRow[] = [];
  let totalF1 = 0;
  let scoredRows = 0;

  // Track aggregated retrieval stats
  let sumP: number[] | null = null;
  let sumR: number[] | null = null;
  let sumMrr = 0;
  let sumNdcg = 0;
  let retrievalCount = 0;

  for (const row of rows) {
    const t0 = performance.now();
    const { answer, retrievedIds } = await ask(row.question);
    const f1 = tokenF1(answer, row.reference);

    totalF1 += f1;
    scoredRows++;
    const evalRow: EvalRow = {
      question: row.question,
      reference: row.reference,
      prediction: answer,
      answerScore: f1,
    };

    if (row.relevantIds && retrievedIds.length > 0) {
      const retEval = evaluateRetrieval(row.relevantIds, retrievedIds, kValues);
      evalRow.retrieval = retEval;

      if (!sumP) sumP = retEval.precisionAtK.map(() => 0);
      if (!sumR) sumR = retEval.recallAtK.map(() => 0);
      retEval.precisionAtK.forEach((v, i) => { if (sumP) sumP[i] += v; });
      retEval.recallAtK.forEach((v, i) => { if (sumR) sumR[i] += v; });
      sumMrr += retEval.mrr;
      sumNdcg += retEval.ndcg;
      retrievalCount++;
    }

    evalRows.push(evalRow);
  }

  const totalMs = performance.now() - startWall;

  const report: BenchmarkReport = {
    dataset,
    scoredRows,
    retrieval: sumP
      ? {
          precisionAtK: sumP.map((v) => v / retrievalCount),
          recallAtK:    sumR!.map((v) => v / retrievalCount),
          mrr:          sumMrr / retrievalCount,
          ndcg:         sumNdcg / retrievalCount,
        }
      : null,
    answer: { tokenF1: scoredRows > 0 ? totalF1 / scoredRows : 0 },
    latencyMs: { avg: totalMs / scoredRows, total: totalMs },
    rows: evalRows,
  };

  return report;
}