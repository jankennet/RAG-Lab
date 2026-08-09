/**
 * Deterministic evaluation metrics — pure functions, no LLM, no network.
 * Shared by the web benchmark route and the unit test suite (Layer 1/2/3a).
 */

// ── Tokenization (normalized) ──────────────────────────────────────

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokens(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function countOverlap(predTokens: string[], refTokens: string[]): number {
  const predCounts = new Map<string, number>();
  const refCounts = new Map<string, number>();

  for (const t of predTokens) predCounts.set(t, (predCounts.get(t) ?? 0) + 1);
  for (const t of refTokens) refCounts.set(t, (refCounts.get(t) ?? 0) + 1);

  let overlap = 0;
  for (const [t, c] of predCounts) {
    overlap += Math.min(c, refCounts.get(t) ?? 0);
  }
  return overlap;
}

// ── Answer status (degenerate-answer guard) ─────────────────────────
// An "answer" that refuses or says there's no context means retrieval/coverage
// failed for that question. It must never be scored as a high-quality answer.

// A refusal is any answer that says the context/ground truth is missing, however
// it is phrased. The old regex required "i cannot" and only caught "does not
// contain" — so "does not mention/specify/define", "cannot answer the question",
// and "does not discuss" slipped through as real answers, got LLM-judged, and
// were rubber-stamped 100% faithful + 100% relevant. Broaden to catch every
// no-answer phrasing; genuine answers rarely contain any of these.
export const REFUSAL_RE =
  /not enough context|insufficient (context|info|information|evidence)|no relevant (context|info|information)|(cannot|can'?t|can not|unable to) answer\b|does no?t (mention|specify|define|discuss|address|provid|contain|include|state|say|support|know)|(context|passage|text|document|chunk)s? (does no?t|do no?t|did no?t|doesn'?t|don'?t) (mention|cover|address|provid|contain|include|support|discuss|state|know)|no (information|mention|sign|reference|definition|details?) (about|of|to|regarding|for)|i (cannot|can'?t|do not|don'?t) (answer|say)/i;

export type AnswerStatus = "answered" | "refused" | "empty";

export function answerStatus(generatedAnswer: string): AnswerStatus {
  const t = generatedAnswer?.trim() ?? "";
  if (!t) return "empty";
  if (REFUSAL_RE.test(t)) return "refused";
  return "answered";
}

/** Clamp into [0, 1]. `NaN` input → 0. */
export function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Lexical overlap F1 between prediction and reference. 0 if either side is empty. */
export function tokenF1(prediction: string, reference: string): number {
  const p = tokens(prediction);
  const r = tokens(reference);
  if (p.length === 0 || r.length === 0) return 0;

  const overlap = countOverlap(p, r);
  const precision = overlap / p.length;
  const recall = overlap / r.length;
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

/** Normalized exact match — does prediction equal reference after normalization? */
export function exactMatch(prediction: string, reference: string): boolean {
  return normalize(prediction) === normalize(reference) && normalize(prediction).length > 0;
}

/** Exact-match score as 0|1 (for aggregating alongside other per-question metrics). */
export function exactMatchScore(prediction: string, reference: string): number {
  return exactMatch(prediction, reference) ? 1 : 0;
}

// ── Retrieval metrics (Layer 2) ────────────────────────────────────

/**
 * Did any relevant doc appear in the retrieved results?
 * Returns NaN when the question has no labeled relevant docs (excluded from aggregates).
 */
export function recallAtK(retrievedIds: string[], relevantIds: string[]): number {
  if (relevantIds.length === 0) return NaN;
  return retrievedIds.some((id) => relevantIds.includes(id)) ? 1 : 0;
}

/** Of the retrieved docs (top-k), how many were actually relevant. */
export function precisionAtK(retrievedIds: string[], relevantIds: string[]): number {
  if (retrievedIds.length === 0) return 0;
  const hits = retrievedIds.filter((id) => relevantIds.includes(id)).length;
  return hits / retrievedIds.length;
}

/** Reciprocal rank of the first relevant doc — 0 if none retrieved. */
export function reciprocalRank(retrievedIds: string[], relevantIds: string[]): number {
  if (relevantIds.length === 0) return NaN;
  const idx = retrievedIds.findIndex((id) => relevantIds.includes(id));
  return idx === -1 ? 0 : 1 / (idx + 1);
}

export function mean(xs: number[]): number {
  const valid = xs.filter((n) => !Number.isNaN(n));
  return valid.length ? valid.reduce((s, n) => s + n, 0) / valid.length : 0;
}

export function meanReciprocalRank(perQuestionRR: number[]): number {
  return mean(perQuestionRR);
}