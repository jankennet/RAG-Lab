/** Per-question evaluation results */
export type QuestionResult = {
  question: string;
  reference: string;
  retrievedCount: number;
  relevantInTopK: number;
  totalRelevant: number;
  recallAtK: number;
  precisionAtK: number;
  hitRateAtK: number;
  retrievedDocTitles: string[];
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
};

export type BenchmarkMetrics = {
  recallAtK: number;
  precisionAtK: number;
  hitRateAtK: number;
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
};

export type BenchmarkRun = {
  id: string;
  datasetId: string;
  datasetName: string;
  totalQuestions: number;
  status: string;
  createdAt: number;
  metrics: BenchmarkMetrics;
  details: QuestionResult[];
};

declare const globalThis: {
  __benchmarkRuns?: BenchmarkRun[];
};

/** In-memory benchmark run store. globalThis ensures one instance across all route files in Next.js. */
export function getRuns(): BenchmarkRun[] {
  if (!globalThis.__benchmarkRuns) {
    globalThis.__benchmarkRuns = [];
  }
  return globalThis.__benchmarkRuns;
}