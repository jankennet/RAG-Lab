/** Compact benchmark storage with disk persistence for Ranking feature. */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

export type CompactQuestionResult = {
  latencyMs: number;
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
  tokenF1: number;
  /** First 80 chars of question — enough for identification, not full text */
  questionLabel: string;
  retrievalCount: number;
  retrievedDocTitles: string[];
};

export type BenchmarkMetrics = {
  latencyMs: number;
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
  tokenF1: number;
};

export type BenchmarkRun = {
  id: string;
  datasetId: string;
  datasetName: string;
  provider: string;
  model: string;
  totalQuestions: number;
  status: string;
  createdAt: number;
  metrics: BenchmarkMetrics;
  /** Compact per-question results — no full text, just scores + label */
  details: CompactQuestionResult[];
};

const BENCHMARKS_DIR = join(process.cwd(), "data", "benchmarks");

function ensureDir(): void {
  mkdirSync(BENCHMARKS_DIR, { recursive: true });
}

/** Save one run to disk as compact JSON. */
export function saveRun(run: BenchmarkRun): void {
  ensureDir();
  const safe = run.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = join(BENCHMARKS_DIR, `${safe}.json`);
  writeFileSync(path, JSON.stringify(run, null, 2));
}

/** Load all runs from disk. */
export function getRuns(): BenchmarkRun[] {
  ensureDir();
  try {
    const files = readdirSync(BENCHMARKS_DIR).filter(
      (f) => f.endsWith(".json"),
    );
    const runs: BenchmarkRun[] = [];
    for (const file of files) {
      try {
        const data = readFileSync(join(BENCHMARKS_DIR, file), "utf-8");
        runs.push(JSON.parse(data) as BenchmarkRun);
      } catch {
        // skip corrupt files
      }
    }
    // Sort newest first
    runs.sort((a, b) => b.createdAt - a.createdAt);
    // Enforce max 100 runs — delete oldest
    while (runs.length > 100) {
      const oldest = runs.pop()!;
      const safe = oldest.id.replace(/[^a-zA-Z0-9_-]/g, "_");
      try {
        const { rmSync } = require("fs");
        rmSync(join(BENCHMARKS_DIR, `${safe}.json`), { force: true });
      } catch {
        // ignore
      }
    }
    return runs;
  } catch {
    return [];
  }
}

/** Get one run by ID. */
export function getRun(id: string): BenchmarkRun | null {
  ensureDir();
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = join(BENCHMARKS_DIR, `${safe}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as BenchmarkRun;
  } catch {
    return null;
  }
}

/** Delete one run. */
export function deleteRun(id: string): void {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = join(BENCHMARKS_DIR, `${safe}.json`);
  try {
    const { rmSync } = require("fs");
    rmSync(path, { force: true });
  } catch {
    // ignore
  }
}