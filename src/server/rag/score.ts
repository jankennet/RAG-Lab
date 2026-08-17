/**
 * Composite RAG Accuracy Score (0 - 100%).
 *
 * Combines multi-layered evaluation metrics:
 * - Retrieval Recall@K (30%)
 * - LLM Faithfulness (35%)
 * - LLM Answer Relevance (25%)
 * - Lexical Token F1 (10%)
 * Plus optional high-latency penalty.
 */

export interface ScoreInputs {
  recallAtK?: number;
  faithfulness: number;
  answerRelevance: number;
  tokenF1: number;
  latencyMs?: number;
}

export interface ScoreBreakdown {
  ragAccuracyScore: number; // 0 - 100
  retrievalScore: number;   // 0 - 100
  generationScore: number;  // 0 - 100
  latencyPenalty: number;   // 0 - 10
}

export function calculateRagAccuracyScore(inputs: ScoreInputs): ScoreBreakdown {
  const { faithfulness, answerRelevance, tokenF1, latencyMs } = inputs;
  const hasRecall = typeof inputs.recallAtK === "number" && !Number.isNaN(inputs.recallAtK);
  const recall = hasRecall ? Math.max(0, Math.min(1, inputs.recallAtK!)) : 0;

  // Normalized base components
  const f = Math.max(0, Math.min(1, faithfulness));
  const r = Math.max(0, Math.min(1, answerRelevance));
  const f1 = Math.max(0, Math.min(1, tokenF1));

  let rawScore = 0;
  if (hasRecall) {
    // 30% Recall, 35% Faithfulness, 25% Relevance, 10% F1
    rawScore = (recall * 0.30) + (f * 0.35) + (r * 0.25) + (f1 * 0.10);
  } else {
    // Unlabeled retrieval fallback: 45% Faithfulness, 35% Relevance, 20% F1
    rawScore = (f * 0.45) + (r * 0.35) + (f1 * 0.20);
  }

  // Latency penalty: 1 point off per 1000ms over 2000ms target (max -10 points)
  let latencyPenalty = 0;
  if (latencyMs && latencyMs > 2000) {
    latencyPenalty = Math.min(10, Math.floor((latencyMs - 2000) / 1000));
  }

  const ragAccuracyScore = Math.max(0, Math.round(rawScore * 100 - latencyPenalty));
  const retrievalScore = Math.round((hasRecall ? recall : 1) * 100);
  const generationScore = Math.round(((f * 0.45) + (r * 0.35) + (f1 * 0.20)) * 100);

  return {
    ragAccuracyScore,
    retrievalScore,
    generationScore,
    latencyPenalty,
  };
}
