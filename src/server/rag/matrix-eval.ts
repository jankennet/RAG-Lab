/**
 * Benchmark Matrix Evaluator.
 *
 * Runs evaluation across parameter matrices (chunking strategies, prompts, top-K).
 */

import { selectChunker, type DocumentType } from "@/server/rag/chunker";
import type { RagDocument } from "@/shared/types";

export interface MatrixOptions {
  chunkerStrategies: Array<"fixed" | "recursive" | "structured">;
  chunkSizes: number[];
  promptVariants: Array<"strict" | "concise" | "cot">;
}

export const SYSTEM_PROMPTS: Record<string, string> = {
  strict:
    "Answer the question strictly from the provided context. " +
    "If the context does not contain the answer, reply that there is insufficient information. Do not use outside knowledge.",
  concise:
    "Answer the question concisely in 1-2 sentences directly from the context. " +
    "Give the answer whenever context contains relevant details.",
  cot:
    "Think step-by-step using the context provided, then state your final concise answer.",
};

export function rechunkCorpus(
  documents: Array<{ sourceKey: string; title: string; content: string }>,
  strategy: "fixed" | "recursive" | "structured",
  chunkSize = 800,
  overlap = 100,
): RagDocument[] {
  const chunker = selectChunker(undefined, strategy);
  const result: RagDocument[] = [];

  let globalId = 0;
  for (const doc of documents) {
    const rawChunks = chunker.split(doc.content, { chunkSize, chunkOverlap: overlap });
    rawChunks.forEach((chunkText, idx) => {
      result.push({
        id: globalId++,
        sourceKey: `${doc.sourceKey}:c${idx}`,
        sourceName: doc.title || "document",
        sourceUrl: null,
        title: doc.title || "document",
        content: chunkText,
        metadata: {},
        chunkIndex: idx,
      });
    });
  }

  return result;
}
