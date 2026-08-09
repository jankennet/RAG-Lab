// Layer 1: deterministic metric unit tests — no LLM, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tokenF1,
  exactMatch,
  exactMatchScore,
  clamp,
  recallAtK,
  precisionAtK,
  reciprocalRank,
  mean,
  meanReciprocalRank,
  answerStatus,
} from "@/server/rag/metrics";

// ── tokenF1 ────────────────────────────────────────────────────────

test("tokenF1: identical strings → 1.0", () => {
  assert.ok(Math.abs(tokenF1("the cat sat", "the cat sat") - 1.0) < 1e-9);
});

test("tokenF1: disjoint strings → 0.0", () => {
  assert.equal(tokenF1("apple banana", "car truck"), 0.0);
});

test("tokenF1: partial overlap → known value", () => {
  // pred={cat,sat} vs ref={cat}: precision 0.5, recall 1 → F1 = 2(0.5·1)/(0.5+1) = 2/3
  assert.ok(Math.abs(tokenF1("cat sat", "cat") - 2 / 3) < 1e-9);
});

test("tokenF1: empty generated answer → 0.0", () => {
  assert.equal(tokenF1("", "some ground truth"), 0.0);
});

test("tokenF1: empty reference → 0.0", () => {
  assert.equal(tokenF1("some prediction", ""), 0.0);
});

test("tokenF1: is case- and punctuation-insensitive", () => {
  assert.ok(Math.abs(tokenF1("The Cat, sat.", "the cat sat") - 1.0) < 1e-9);
});

// ── exactMatch ─────────────────────────────────────────────────────

test("exactMatch: true for normalized-equal strings", () => {
  assert.equal(exactMatch("New York", " new york "), true);
});

test("exactMatch: false for different strings", () => {
  assert.equal(exactMatch("cats", "cat"), false);
});

test("exactMatch: false when either side is empty after normalize", () => {
  assert.equal(exactMatch("", " "), false);
});

test("exactMatchScore: 1 for match, 0 for mismatch", () => {
  assert.equal(exactMatchScore("a b", "a b"), 1);
  assert.equal(exactMatchScore("a b", "b a"), 0);
});

// ── clamp ──────────────────────────────────────────────────────────

test("clamp: values inside [0,1] pass through", () => {
  assert.equal(clamp(0.3), 0.3);
  assert.equal(clamp(0), 0);
  assert.equal(clamp(1), 1);
});

test("clamp: outside bounds clamp to edges", () => {
  assert.equal(clamp(-0.5), 0);
  assert.equal(clamp(1.5), 1);
});

test("clamp: NaN → 0", () => {
  assert.equal(clamp(Number.NaN), 0);
});

// ── retrieval metrics (Layer 2) ────────────────────────────────────

test("recallAtK: 1 when a relevant doc is retrieved", () => {
  assert.equal(recallAtK(["a", "b"], ["b"]), 1);
});

test("recallAtK: 0 when no relevant doc retrieved", () => {
  assert.equal(recallAtK(["a", "b"], ["c"]), 0);
});

test("recallAtK: NaN for unlabeled question (excluded from aggregate)", () => {
  assert.ok(Number.isNaN(recallAtK(["a"], [])));
});

test("precisionAtK: hit fraction of retrieved docs", () => {
  // 2 of 4 retrieved are relevant → 0.5
  assert.equal(precisionAtK(["a", "x", "b", "y"], ["a", "b"]), 0.5);
});

test("precisionAtK: 0 on empty retrieval", () => {
  assert.equal(precisionAtK([], ["a"]), 0);
});

test("reciprocalRank: inverse of first hit position", () => {
  assert.equal(reciprocalRank(["a", "b", "c"], ["c"]), 1 / 3);
});

test("reciprocalRank: 0 when nothing relevant retrieved", () => {
  assert.equal(reciprocalRank(["a", "b"], ["z"]), 0);
});

test("reciprocalRank: NaN for unlabeled question", () => {
  assert.ok(Number.isNaN(reciprocalRank(["a"], [])));
});

test("mean: excludes NaN, 0 on empty", () => {
  assert.equal(mean([1, NaN, 2, NaN]), 1.5);
  assert.equal(mean([]), 0);
});

test("meanReciprocalRank: averages per-question RR", () => {
  // 1/1 + 1/2 + 0 → 0.5
  assert.equal(meanReciprocalRank([1, 0.5, 0]), 0.5);
});

// ── answerStatus (degenerate-answer guard) ──────────────────────────

test("answerStatus: flags the benchmark refusal sentinel as refused", () => {
  assert.equal(answerStatus("Not enough context to answer."), "refused");
});

test("answerStatus: flags other refusals as refused", () => {
  assert.equal(answerStatus("I cannot answer that from the provided context."), "refused");
  assert.equal(answerStatus("There is no relevant context to answer this."), "refused");
});

test("answerStatus: empty / whitespace → empty", () => {
  assert.equal(answerStatus(""), "empty");
  assert.equal(answerStatus("   "), "empty");
  assert.equal(answerStatus(undefined as unknown as string), "empty");
});

test("answerStatus: catches low-context refusals beyond the old 'does not contain' set", () => {
  // These all escaped the older regex (which only caught "does not contain" +
  // "i cannot answer"), got LLM-judged, and were rubber-stamped 100% relevant.
  assert.equal(answerStatus("The context does not mention T-cell count or HAdV-55 infection, so it cannot answer the question."), "refused");
  assert.equal(answerStatus('The context does not define or mention "MVO."'), "refused");
  assert.equal(answerStatus("The context does not specify how untreated MDA-MB-231 cells were labeled."), "refused");
  assert.equal(answerStatus("The context does not discuss the number of inhabitants."), "refused");
  assert.equal(answerStatus("So it cannot answer the question with the given passage."), "refused");
});

test("answerStatus: real answers → answered (a refusal must not score as quality)", () => {
  assert.equal(answerStatus("Paris is the capital of France."), "answered");
  // Grounded factual answer — names a limitation but still answers.
  assert.equal(answerStatus("The untreated MDA-MB-231 cells were labeled with Calcein AM and Ethidium homodimer-1."), "answered");
});