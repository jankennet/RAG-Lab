// Layer 2: retrieval evaluation orchestration — deterministic, no LLM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRetrieval } from "@/server/rag/retrieval-eval";

const corpus = [
  { sourceKey: "paris", title: "Paris travel", content: "Paris is the capital of France." },
  { sourceKey: "tokyo", title: "Tokyo travel", content: "Tokyo is the capital of Japan." },
  { sourceKey: "cooking", title: "Cooking", content: "How to make beef stew." },
];

test("evaluateRetrieval: recalls the relevant doc for a matching question", () => {
  const result = evaluateRetrieval(
    [{ id: "q1", question: "capital of France", relevantDocIds: ["paris"] }],
    corpus,
    3,
  );
  assert.equal(result.recallAtK, 1);
  assert.equal(result.perQuestion[0].recall, 1);
});

test("evaluateRetrieval: zero recall when the relevant doc is not retrieved", () => {
  // topK=1 so only the top hit is retrieved; "paris" is not the match for "beef stew".
  const result = evaluateRetrieval(
    [{ id: "q1", question: "beef stew", relevantDocIds: ["paris"] }],
    corpus,
    1,
  );
  assert.equal(result.perQuestion[0].retrievedIds[0], "cooking");
  assert.equal(result.perQuestion[0].recall, 0);
  assert.equal(result.recallAtK, 0);
});

test("evaluateRetrieval: excludes unlabeled questions from aggregates", () => {
  const result = evaluateRetrieval(
    [
      { id: "q1", question: "capital", relevantDocIds: ["paris"] },
      { id: "q2", question: "whatever", relevantDocIds: [] }, // no label
    ],
    corpus,
    3,
  );
  assert.equal(result.labeledCount, 1);
  assert.equal(result.recallAtK, 1); // only q1 counted
  assert.ok(Number.isNaN(result.perQuestion[1].recall));
});

test("evaluateRetrieval: empty corpus yields zero aggregates", () => {
  const result = evaluateRetrieval(
    [{ id: "q1", question: "anything", relevantDocIds: ["missing"] }],
    [],
    3,
  );
  assert.equal(result.recallAtK, 0);
  assert.equal(result.mrr, 0);
});