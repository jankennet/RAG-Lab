// Tuning knobs for the benchmark UI, lifted out of the page so the hook + form
// component share one source of truth. Two clusters:
//   - question-limit (the "Run Benchmark" form): default 10, capped at 200.
//   - HF import max-rows: default 200, capped at 5000 (server enforces the same
//     ceiling — see /api/benchmark-datasets route).
// The example dataset id is the placeholder shown across the import forms.

/** Example HF dataset used in import-form placeholders + help text. */
export const EXAMPLE_DATASET_ID = "galileo-ai/ragbench";

// ── Run form: question limit ────────────────────────────────────────────────
export const DEFAULT_QUESTION_LIMIT = 10;
export const MAX_QUESTION_LIMIT = 200;

// ── Import form: max rows pulled from HF ───────────────────────────────────
export const DEFAULT_IMPORT_MAX_ROWS = "200";
export const MAX_IMPORT_ROWS = 5000;
export const MIN_IMPORT_ROWS = 1;
