// Metric definition table for the benchmark detail view. Pure data, React-free.
// Lifted verbatim from app/(dashboard)/benchmarks/[id]/page.tsx (L9-59).
// `key` indexes into `BenchmarkMetrics`; `isLatency` flips badge choice + hides
// the percentage progress bar.

import type { BenchmarkMetrics } from "@/client/opfs";

export type MetricDef = {
  key: keyof BenchmarkMetrics;
  label: string;
  question: string;
  definition: string;
  suffix: string;
  isLatency: boolean;
};

export const METRICS: MetricDef[] = [
  {
    key: "tokenF1",
    label: "Token F1",
    question: "How accurate is the answer?",
    definition: "Token-overlap F1 between generated answer and reference document content.",
    suffix: "higher is better",
    isLatency: false,
  },
  {
    key: "latencyMs",
    label: "Latency",
    question: "How fast is the retrieval?",
    definition: "Average time per question to search + evaluate + generate answer.",
    suffix: "lower is better",
    isLatency: true,
  },
  {
    key: "faithfulness",
    label: "Faithfulness",
    question: "Is the context factually correct?",
    definition: "Does the retrieved context contain factually consistent information?",
    suffix: "higher is better",
    isLatency: false,
  },
  {
    key: "answerRelevance",
    label: "Answer Relevance",
    question: "Does the context address the question?",
    definition: "Does the generated answer actually address the question asked?",
    suffix: "higher is better",
    isLatency: false,
  },
  {
    key: "exactMatch",
    label: "Exact Match",
    question: "Does the answer match the ground truth?",
    definition: "Normalized exact-match against the reference answer.",
    suffix: "higher is better",
    isLatency: false,
  },
];
