/**
 * Universal benchmark CLI.
 *
 * Usage:
 *   tsx scripts/benchmark.ts --dataset <name> --questions <file.json> [options]
 *
 * Questions file format:
 *   [{ question: "...", reference: "...", relevantIds?: [...] }]
 *
 * Examples:
 *   tsx scripts/benchmark.ts --dataset galileo-ai_ragbench --questions bench-qs.json
 *   tsx scripts/benchmark.ts --dataset galileo-ai_ragbench --questions-from-hf
 */
import "dotenv/config";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { runRagGraphWithRetrieval } from "@/server/rag/graph";
import { runBenchmark } from "@/server/rag/benchmark";
import { DATA_DIR } from "@/server/ingestion/store";
import type { RagDocument } from "@/shared/types";

const questionSchema = z.object({
  question: z.string().min(1),
  reference: z.string().min(1),
  relevantIds: z.array(z.string()).optional(),
});

function parseArgs(): Record<string, string | boolean> {
  const args = process.argv.slice(2);
  const map: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
      if (val !== true) i++;
      map[key] = val;
    }
  }
  return map;
}

function loadLocalDataset(name: string) {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = join(DATA_DIR, safeName);
  if (!existsSync(dir)) {
    throw new Error(`Dataset "${name}" not found at ${dir}. Run \`tsx scripts/ingest.ts\` first.`);
  }

  const files = readdirSync(dir).filter((f) => f.startsWith("chunks_") && f.endsWith(".json"));
  const docs: RagDocument[] = [];

  for (const file of files) {
    const rows: Array<{
      source_key: string;
      source_name: string;
      source_url: string | null;
      title: string;
      content: string;
      metadata: Record<string, unknown>;
      chunk_index: number;
    }> = JSON.parse(readFileSync(join(dir, file), "utf-8"));

    for (let i = 0; i < rows.length; i++) {
      docs.push({
        id: docs.length,
        sourceKey: rows[i].source_key,
        sourceName: rows[i].source_name,
        sourceUrl: rows[i].source_url,
        title: rows[i].title,
        content: rows[i].content,
        metadata: rows[i].metadata,
        chunkIndex: rows[i].chunk_index,
      });
    }
  }

  return docs;
}

function keywordSearch(docs: RagDocument[], query: string, topK = 4): RagDocument[] {
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return docs.slice(0, topK);

  const scored = docs.map((doc) => {
    const contentLower = doc.content.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      score += (titleLower.split(tok).length - 1) * 3;
      score += contentLower.split(tok).length - 1;
    }
    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => ({ ...s.doc, similarity: s.score }));
}

async function main() {
  const args = parseArgs();
  const datasetName = args.dataset as string | undefined;
  const questionsFile = args.questions as string | undefined;
  const questionsFromHf = args["questions-from-hf"] as boolean | undefined;

  if (!datasetName) {
    console.error("Usage: tsx scripts/benchmark.ts --dataset <name> --questions <file.json>");
    console.error("  or:  tsx scripts/benchmark.ts --dataset <name> --questions-from-hf");
    console.error("");
    console.error("Options:");
    console.error("  --dataset            Local dataset name (required)");
    console.error("  --questions          JSON file with question/reference pairs");
    console.error("  --questions-from-hf  Fetch questions from HF datasets-server");
    console.error("  --provider           LLM provider (default nvidia)");
    console.error("  --model              LLM model");
    process.exitCode = 1;
    return;
  }

  // Load local chunks
  console.log(`Loading dataset: ${datasetName}`);
  const docs = loadLocalDataset(datasetName);
  console.log(`Chunks: ${docs.length}`);

  // Load questions
  let rows: Array<{ question: string; reference: string }>;
  if (questionsFile) {
    const raw = readFileSync(questionsFile, "utf-8");
    if (questionsFile.endsWith(".json")) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      rows = list.map((r: unknown) => questionSchema.parse(r));
    } else {
      // CSV: header row, question,reference
      const lines = raw.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(",");
      const qIdx = headers.findIndex((h: string) => h.toLowerCase().includes("question"));
      const rIdx = headers.findIndex((h: string) => h.toLowerCase().includes("answer"));
      if (qIdx === -1 || rIdx === -1) throw new Error("CSV needs 'question','answer' columns");
      rows = lines.slice(1).map((l: string) => {
        const cols = l.split(",");
        return { question: cols[qIdx], reference: cols[rIdx] };
      });
    }
  } else if (questionsFromHf) {
    const { downloadHfRows } = await import("@/server/ingestion/download");
    const { parseContent } = await import("@/server/ingestion/parse");

    // Use dataset name as HF dataset name
    const hfName = datasetName.replace(/_/g, "/");
    const result = await downloadHfRows(hfName, "default", "train", 25);
    const { rows: hfRows, fieldHints } = parseContent(result.raw, result.contentType);

    if (hfRows.length === 0) throw new Error("No HF rows found");
    const qField = args["hf-question-field"] as string || fieldHints.title || "question";
    const aField = args["hf-answer-field"] as string || "answer";

    rows = hfRows
      .map((r: Record<string, unknown>) => ({
        question: String(r[qField] ?? ""),
        reference: String(r[aField] ?? ""),
      }))
      .filter((r: { question: string; reference: string }) => r.question && r.reference);
    console.log(`HF questions fetched: ${rows.length}`);
  } else {
    console.error("Provide --questions <file.json> or --questions-from-hf");
    process.exitCode = 1;
    return;
  }

  if (rows.length === 0) {
    console.log("No valid rows to benchmark.");
    return;
  }

  console.log(`Questions: ${rows.length}`);
  console.log("");

  // Run benchmark
  const report = await runBenchmark(
    datasetName,
    rows.map((r) => ({ question: r.question, reference: r.reference })),
    async (question) => {
      const retrieved = keywordSearch(docs, question, 4);
      const result = await runRagGraphWithRetrieval(question, async () => retrieved, {
        apiKeys: {},
      });
      return {
        answer: result.answer,
        retrievedIds: result.documents.map((d) => d.sourceKey),
      };
    },
  );

  // Print report
  console.log("=".repeat(60));
  console.log(`RAG Benchmark Report — ${report.dataset}`);
  console.log("=".repeat(60));
  console.log(`Scored rows:   ${report.scoredRows}`);
  console.log(`Total latency: ${report.latencyMs.total.toFixed(0)} ms`);
  console.log(`Avg latency:   ${report.latencyMs.avg.toFixed(0)} ms`);
  console.log("");
  console.log("─ Answer Quality ─");
  console.log(`Token F1: ${(report.answer.tokenF1 * 100).toFixed(2)}%`);
  console.log("");

  if (report.retrieval) {
    console.log("─ Retrieval Quality ─");
    console.log(`MRR:      ${report.retrieval.mrr.toFixed(4)}`);
    console.log(`nDCG:     ${report.retrieval.ndcg.toFixed(4)}`);
    console.log(`Precision@K: ${report.retrieval.precisionAtK.map((v, i) => `@${[1, 3, 5, 10][i]}: ${(v * 100).toFixed(1)}%`).join(", ")}`);
    console.log(`Recall@K:    ${report.retrieval.recallAtK.map((v, i) => `@${[1, 3, 5, 10][i]}: ${(v * 100).toFixed(1)}%`).join(", ")}`);
    console.log("");
  }

  const sorted = [...report.rows].sort((a, b) => a.answerScore - b.answerScore);
  console.log("─ Best 3 ─");
  for (const r of sorted.slice(-3).reverse()) {
    console.log(`  F1=${(r.answerScore * 100).toFixed(1)}% Q: ${r.question.slice(0, 80)}`);
  }
  console.log("\n─ Worst 3 ─");
  for (const r of sorted.slice(0, 3)) {
    console.log(`  F1=${(r.answerScore * 100).toFixed(1)}% Q: ${r.question.slice(0, 80)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});