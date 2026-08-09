/**
 * Layer 2 — Retrieval quality evaluation. Deterministic, no LLM.
 * Answers "did retrieval pull the right chunks?" independent of generation,
 * so a low score here means keyword search is the bottleneck — not the LLM.
 */
import { keywordSearch } from "@/server/rag/retrieval";
import { recallAtK, precisionAtK, reciprocalRank, meanReciprocalRank } from "@/server/rag/metrics";

export type RetrievalQuestion = {
  id: string;
  question: string;
  /** Chunks (by sourceKey) that should be retrieved for this question. */
  relevantDocIds?: string[];
};

export type RetrievalQuestionResult = {
  questionId: string;
  retrievedIds: string[];
  recall: number;
  precision: number;
  reciprocalRank: number;
};

export type RetrievalEvalResult = {
  perQuestion: RetrievalQuestionResult[];
  recallAtK: number;
  precisionAtK: number;
  mrr: number;
  /** Questions that carried no relevance label are excluded from aggregates. */
  labeledCount: number;
};

export function evaluateRetrieval(
  questions: RetrievalQuestion[],
  corpus: Array<{ title: string; content: string; sourceKey: string }>,
  topK: number,
): RetrievalEvalResult {
  const labeled = questions.filter((q) => (q.relevantDocIds?.length ?? 0) > 0);

  const perQuestion: RetrievalQuestionResult[] = questions.map((q) => {
    const retrieved = keywordSearch(corpus, q.question, topK);
    const retrievedIds = retrieved.map((d) => d.sourceKey);
    const relevant = q.relevantDocIds ?? [];
    return {
      questionId: q.id,
      retrievedIds,
      recall: recallAtK(retrievedIds, relevant),
      precision: precisionAtK(retrievedIds, relevant),
      reciprocalRank: reciprocalRank(retrievedIds, relevant),
    };
  });

  // Aggregates over labeled questions only (unlabeled → NaN, excluded by mean()).
  const labeledResults = perQuestion.filter((r) =>
    labeled.some((q) => q.id === r.questionId),
  );

  return {
    perQuestion,
    recallAtK: meanOf(labeledResults.map((r) => r.recall)),
    precisionAtK: meanOf(labeledResults.map((r) => r.precision)),
    mrr: meanReciprocalRank(labeledResults.map((r) => r.reciprocalRank)),
    labeledCount: labeledResults.length,
  };
}

function meanOf(xs: number[]): number {
  const valid = xs.filter((n) => !Number.isNaN(n));
  return valid.length ? valid.reduce((s, n) => s + n, 0) / valid.length : 0;
}