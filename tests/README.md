# Tests

Zero-dependency suite using Node's built-in test runner (`node:test`) + `tsx`
(for TypeScript + `@/` path aliases). No network, no API keys, no LLM.

## Run

```bash
npm test        # node --import tsx --test "tests/**/*.test.ts"
npm run typecheck
```

## Coverage (map to the benchmark layers)

| Layer | File | What it guards |
|---|---|---|
| L1 | `tests/unit/metrics.test.ts` | `tokenF1`, `exactMatch`, `clamp`, retrieval metric functions |
| L1 | `tests/unit/retrieval.test.ts` | `keywordSearch` ordering, topK, empty corpus, empty query |
| L2 | `tests/unit/retrieval-eval.test.ts` | `evaluateRetrieval` aggregates + unlabeled exclusion |
| L4 | `tests/unit/adversarial-cases.test.ts` | adversarial pass/fail predicates |

## Under test (canonical, shared)

- `src/server/rag/metrics.ts` — descriptive metric functions
- `src/server/rag/retrieval.ts` — single `keywordSearch` (deduped from 3 copies)
- `src/server/rag/retrieval-eval.ts` — Layer 2 orchestration
- `src/server/rag/adversarial-cases.ts` — Layer 4 fixtures