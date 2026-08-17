/**
 * Synthetic Golden Dataset Generator.
 *
 * Uses LLMs to generate high-quality Question / Ground-Truth Answer pairs
 * directly from document chunks with document-id references for retrieval scoring.
 */

import { callLlm } from "@/server/rag/providers";
import type { ApiKeyStore, LlmProvider } from "@/shared/types";

export interface SyntheticItem {
  id: string;
  question: string;
  groundTruth: string;
  relevantDocIds: string[];
}

export interface GenerateSyntheticOptions {
  provider: LlmProvider;
  model: string;
  apiKeys: ApiKeyStore;
  documents: Array<{ sourceKey: string; title: string; content: string }>;
  numQuestions?: number;
}

export async function generateSyntheticDataset(
  options: GenerateSyntheticOptions,
): Promise<SyntheticItem[]> {
  const { provider, model, apiKeys, documents, numQuestions = 10 } = options;

  if (!documents.length) return [];

  // Distribute target count evenly across documents
  const targetPerDoc = Math.max(1, Math.ceil(numQuestions / documents.length));
  const results: SyntheticItem[] = [];

  for (const doc of documents) {
    if (results.length >= numQuestions) break;

    const prompt =
      `You are an AI benchmark engineer creating a golden dataset for evaluation.\n` +
      `Generate up to ${targetPerDoc} clear, specific question-and-answer pairs based ONLY on the text below.\n` +
      `Each item must be factually grounded in the text.\n\n` +
      `DOCUMENT TITLE: ${doc.title || "Untitled"}\n` +
      `DOCUMENT CONTENT:\n${doc.content}\n\n` +
      `Output format: Return ONLY a JSON array of objects with keys "question" and "groundTruth". No markdown, no extra commentary.\n` +
      `Example: [{"question": "What is X?", "groundTruth": "X is Y."}]`;

    try {
      const rawResponse = await callLlm({
        provider,
        model,
        messages: [
          { role: "system", content: "You output only valid raw JSON." },
          { role: "user", content: prompt },
        ],
        apiKeys,
        temperature: 0.3,
        maxTokens: 1024,
      });

      const cleaned = rawResponse.replace(/```(?:json)?\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length; i++) {
          if (results.length >= numQuestions) break;
          const item = parsed[i];
          if (item?.question && item?.groundTruth) {
            results.push({
              id: `syn-${results.length + 1}`,
              question: String(item.question).trim(),
              groundTruth: String(item.groundTruth).trim(),
              relevantDocIds: [doc.sourceKey],
            });
          }
        }
      }
    } catch {
      // Continue on parsing/LLM generation failure for individual doc
      continue;
    }
  }

  return results;
}
