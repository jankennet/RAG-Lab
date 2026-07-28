import type { Dataset, ProviderConfig } from "@/shared/types";
import { PROVIDERS } from "@/shared/types";

export const dashboardProviders: ProviderConfig[] = PROVIDERS;

export const dashboardDatasets: Dataset[] = [
  {
    id: "ragbench-covidqa",
    name: "RAGBench / CovidQA",
    description: "Benchmark corpus for retrieval quality and answer grounding.",
    source: "url",
    sourceUrl: "https://huggingface.co/datasets/galileo-ai/ragbench",
    rowCount: 12000,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
    status: "ready"
  },
  {
    id: "support-kb",
    name: "Support KB",
    description: "Private FAQ and docs set for company support chat.",
    source: "upload",
    rowCount: 2840,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    status: "loading"
  },
  {
    id: "product-notes",
    name: "Product Notes",
    description: "Changelog, PRDs, and launch notes for internal agent testing.",
    source: "huggingface",
    sourceUrl: "https://huggingface.co/datasets/openai/gsm8k",
    rowCount: 910,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 13,
    status: "error",
    error: "Missing metadata mapping for documents"
  }
];

export const suggestedPrompts = [
  "Summarize dataset with source citations.",
  "Find contradictions in these ask.",
  "Answer like Claude, but cite every source.",
  "What chunks should I fix before ingestion?"
];

export function getDatasetById(id: string) {
  return dashboardDatasets.find((dataset) => dataset.id === id);
}