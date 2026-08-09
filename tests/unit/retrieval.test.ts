// Layer 1: keyword search unit tests — deterministic, no LLM, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { keywordSearch, type SearchableDoc } from "@/server/rag/retrieval";

const corpus: SearchableDoc[] = [
  { sourceKey: "a", title: "Paris travel guide", content: "Paris is the capital of France." },
  { sourceKey: "b", title: "Tokyo travel guide", content: "Tokyo is the capital of Japan." },
  { sourceKey: "c", title: "Cooking recipes", content: "How to make beef stew." },
];

test("keywordSearch: ranks title matches above content-only matches", () => {
  const results = keywordSearch(corpus, "Paris", 2);
  assert.equal(results[0].sourceKey, "a");
});

test("keywordSearch: returns docs unscored when query has no usable tokens", () => {
  // "a" is a single-char token → filtered out → no search signal
  const results = keywordSearch(corpus, "a", 2);
  assert.ok(results.every((r) => r.score === 0));
});

test("keywordSearch: returns empty array for empty corpus", () => {
  assert.deepEqual(keywordSearch([], "Paris", 5), []);
});

test("keywordSearch: respects topK limit", () => {
  const results = keywordSearch(corpus, "the relevant", 2);
  assert.ok(results.length <= 2);
});

test("keywordSearch: empty query returns topK unscored docs", () => {
  const results = keywordSearch(corpus, "", 2);
  assert.equal(results.length, 2);
  assert.equal(results[0].sourceKey, "a");
});

test("keywordSearch: found relevant doc outranks unrelated doc", () => {
  const results = keywordSearch(corpus, "Japan", 3);
  // Tokyo doc has "Japan" in title + content → highest score
  assert.equal(results[0].sourceKey, "b");
});

test("keywordSearch: query and document normalize identically (hyphen vs space)", () => {
  const docs: SearchableDoc[] = [
    { sourceKey: "noise", title: "row-1", content: "some unrelated filler words appearing in several documents." },
    { sourceKey: "answer", title: "row-2", content: "The alpha-beta ratio is measured in the assay result." },
  ];
  // Query "alpha-beta ratio" strips the hyphen on both sides → must still match
  // the hyphenated form inside the document content.
  const results = keywordSearch(docs, "What is the alpha-beta ratio?", 1);
  assert.equal(results[0].sourceKey, "answer");
});

test("keywordSearch: IDF rescues a rare-token answer drowned by common-term noise", () => {
  // Large corpus: the answer row carries one rare token; noise rows repeat the
  // query's common terms many times each. Without IDF weighting the noise
  // outscored the answer and it fell outside top-5.
  const docs: SearchableDoc[] = [
    { sourceKey: "answer", title: "row-1", content: "zephyrium is the name used in the cited passage." },
  ];
  const noise = Array.from({ length: 1789 }, (_, i) => ({
    sourceKey: `n${i}`,
    title: `row-${i + 2}`,
    content: `the study the data the result the name the found the analysis the is the a the of the.`,
  }));
  const results = keywordSearch([...docs, ...noise], "What is zephyrium?", 5);
  assert.equal(results[0].sourceKey, "answer");
});

test("keywordSearch: dedupes consecutive chunks sharing a sourceKey", () => {
  const docs: SearchableDoc[] = [
    { sourceKey: "row-3", title: "row-3", content: "labels sample A with dye X, sample B with dye Y. staining viability live dead." },
    { sourceKey: "row-3", title: "row-3", content: "dye X and dye Y mark live and dead populations respectively." },
    { sourceKey: "other", title: "row-7", content: "unrelated growth data." },
  ];
  const results = keywordSearch(docs, "How were the samples labeled?", 5);
  const keys = results.map((d) => d.sourceKey);
  // Same row appears at most once — duplicate chunks don't crowd top-k.
  assert.equal(keys.filter((k) => k === "row-3").length, 1);
});

test("keywordSearch: dedupes by ROW, not by chunk-level sourceKey", () => {
  // Real ingest emits per-chunk sourceKeys ("kb:row:905:2"). Dedup must strip
  // the trailing ":<chunkIndex>" so one abstract can't fill several top-k slots.
  const docs: SearchableDoc[] = [
    { sourceKey: "kb:row:905:0", title: "Abstract A", content: "adenovirus type 7 causes severe infection, and the T cell response to severe human infection." },
    { sourceKey: "kb:row:905:1", title: "Abstract A", content: "severity of adenovirus infection correlates with T cell counts in severe cases." },
    { sourceKey: "kb:row:905:2", title: "Abstract A", content: "adenovirus infection causes a more severe illness and T cell involvement." },
    { sourceKey: "kb:row:7:0", title: "Unrelated", content: "cooking onions and stock." },
  ];
  const results = keywordSearch(docs, "What role does T-cell count play in severe human adenovirus infection?", 4);
  const rows = results.map((d) => d.sourceKey.replace(/:\d+$/, ""));
  // Only one chunk per row in top-k, and the row competes on its best chunk.
  assert.equal(rows.filter((r) => r === "kb:row:905").length, 1);
  assert.equal(new Set(rows).size, rows.length);
});