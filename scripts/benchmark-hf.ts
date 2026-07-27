import "dotenv/config";
import { z } from "zod";
import { loadEnv, benchmarkEnvSchema } from "@/lib/env";
import { fetchHuggingFaceDatasetRows } from "@/lib/hf-datasets";
import { runRagGraph } from "@/lib/graph";

const env = loadEnv(benchmarkEnvSchema);

const scoreRowSchema = z.record(z.any());

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenF1(prediction: string, reference: string) {
  const predictedTokens = normalizeText(prediction).split(/\s+/).filter(Boolean);
  const referenceTokens = normalizeText(reference).split(/\s+/).filter(Boolean);

  if (predictedTokens.length === 0 || referenceTokens.length === 0) {
    return 0;
  }

  const predictedCounts = new Map<string, number>();
  const referenceCounts = new Map<string, number>();

  for (const token of predictedTokens) {
    predictedCounts.set(token, (predictedCounts.get(token) ?? 0) + 1);
  }

  for (const token of referenceTokens) {
    referenceCounts.set(token, (referenceCounts.get(token) ?? 0) + 1);
  }

  let overlap = 0;
  for (const [token, count] of predictedCounts) {
    overlap += Math.min(count, referenceCounts.get(token) ?? 0);
  }

  const precision = overlap / predictedTokens.length;
  const recall = overlap / referenceTokens.length;

  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

function readString(row: Record<string, unknown>, fieldName: string) {
  const value = row[fieldName];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

async function main() {
  const rows = await fetchHuggingFaceDatasetRows({
    datasetName: env.HF_DATASET_NAME,
    datasetConfig: env.HF_DATASET_CONFIG,
    split: env.HF_DATASET_SPLIT,
    limit: env.HF_BENCHMARK_LIMIT
  });

  let totalF1 = 0;
  let scoredRows = 0;

  for (const row of rows) {
    const parsedRow = scoreRowSchema.parse(row);
    const question = readString(parsedRow, env.HF_BENCHMARK_QUESTION_FIELD).trim();
    const reference = readString(parsedRow, env.HF_BENCHMARK_REFERENCE_FIELD).trim();

    if (!question || !reference) {
      continue;
    }

    const prediction = await runRagGraph(question, 4);
    const score = tokenF1(prediction.answer, reference);

    totalF1 += score;
    scoredRows += 1;

    console.log(JSON.stringify({ question, score, answer: prediction.answer.slice(0, 180) }, null, 2));
  }

  const averageF1 = scoredRows > 0 ? totalF1 / scoredRows : 0;

  console.log(JSON.stringify({ dataset: env.HF_DATASET_NAME, scoredRows, averageF1 }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});