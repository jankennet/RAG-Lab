/**
 * Benchmark CLI.
 *
 * Usage:
 *   tsx scripts/benchmark.ts --dataset <name> --questions <file.json> [options]
 *
 * Questions file format:
 *   [{ question: "...", reference: "..." }]
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
import { evaluateRetrieval, type RetrievalQuestion } from "@/server/rag/retrieval-eval";
import { loadRagbench, corpusCoversQuestions } from "@/server/rag/ragbench";
import { DATA_DIR } from "@/server/ingestion/store";
import { parseContent } from "@/server/ingestion/parse";
import type { RagDocument } from "@/shared/types";

const questionSchema = z.object({
  question: z.string().min(1),
  reference: z.string().min(1),
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

async function keywordSearch(docs: RagDocument[], query: string, topK = 4): Promise<RagDocument[]> {
  const {
    keywordSearch: rank,
  } = await import("@/server/rag/retrieval");
  const hitKeys = new Set(rank(docs, query, topK).map((d) => d.sourceKey));
  return docs.filter((d) => hitKeys.has(d.sourceKey)).slice(0, topK);
}

async function main() {
  const args = parseArgs();
  const datasetName = args.dataset as string | undefined;
  const questionsFile = args.questions as string | undefined;
  const questionsFromHf = args["questions-from-hf"] as boolean | undefined;

  // ── RagBench mode: evidence-aware corpus + guaranteed coverage ──
  const ragbenchConfig = args["ragbench-config"] as string | undefined;

  if (!datasetName && !ragbenchConfig) {
    console.error("Usage: tsx scripts/benchmark.ts --dataset <name> --questions <file.json>");
    console.error("  or:  tsx scripts/benchmark.ts --ragbench-config covidqa,pubmedqa,expertqa [--rows 25]");
    console.error("");
    console.error("Options:");
    console.error("  --dataset            Local dataset name");
    console.error("  --questions          JSON or CSV file with question/reference pairs");
    console.error("  --questions-from-hf  Fetch questions from HF datasets-server");
    console.error("  --ragbench-config    Comma-separated RagBench configs (evidence-aware corpus, no LLM needed)");
    console.error("  --rows               Train rows per config (default 25)");
    console.error("  --provider           LLM provider (default nvidia)");
    console.error("  --model              LLM model");
    process.exitCode = 1;
    return;
  }

  let docs: RagDocument[] = [];
  let retrievalQuestions: RetrievalQuestion[] = [];

  if (ragbenchConfig) {
    const configs = ragbenchConfig.split(",").map((s) => s.trim()).filter(Boolean);
    const rowsPer = Number(args.rows ?? 25);
    console.log(`Loading RagBench configs: ${configs.join(", ")} (${rowsPer} rows each)`);
    const { corpus, questions } = await loadRagbench(configs, rowsPer);
    const cov = corpusCoversQuestions({ corpus, questions });
    console.log(`Corpus docs: ${corpus.length}`);
    console.log(`Coverage ceiling: ${cov.covered}/${cov.total} questions have evidence in corpus`);
    docs = corpus.map((d, i) => ({
      id: i,
      sourceKey: d.sourceKey,
      sourceName: "ragbench",
      sourceUrl: null,
      title: d.title,
      content: d.content,
      metadata: {},
      chunkIndex: 0,
    }));
    retrievalQuestions = questions.map((q) => ({
      id: q.id,
      question: q.question,
      relevantDocIds: q.relevantDocKeys,
    }));
    const rows = questions.map((q) => ({ question: q.question, reference: q.reference }));
    return runBenchmarkCli(datasetName ?? ragbenchConfig, rows, docs, retrievalQuestions, args);
  }

  if (!datasetName) {
    console.error("No dataset name provided.");
    process.exitCode = 1;
    return;
  }

  // Load local chunks
  console.log(`Loading dataset: ${datasetName}`);
  docs = loadLocalDataset(datasetName);
  console.log(`Chunks: ${docs.length}`);

  // Load questions
  let rows: Array<{ question: string; reference: string }>;
  if (questionsFile) {
    const raw = readFileSync(questionsFile, "utf-8");
    if (questionsFile.endsWith(".json")) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      rows = list.map((r: unknown) => questionSchema.parse(r));
    } else if (questionsFile.endsWith(".csv")) {
      // Use shared CSV parser that handles quoted fields properly
      const { rows: parsedRows, fieldHints } = parseContent(raw, "text/csv");
      const qField = args["hf-question-field"] as string || fieldHints.title || parsedRows[0] ? Object.keys(parsedRows[0]).find(k => k.toLowerCase().includes("question")) || "" : "";
      const aField = args["hf-answer-field"] as string || "answer";
      rows = parsedRows
        .map((r: Record<string, unknown>) => ({
          question: String(r[qField] ?? r[Object.keys(r)[0]] ?? ""),
          reference: String(r[aField] ?? r[Object.keys(r)[1]] ?? ""),
        }))
        .filter((r: { question: string; reference: string }) => r.question && r.reference);

      if (rows.length === 0) {
        // Fallback: try raw CSV manual parse for different column names
        const lines = raw.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(",");
        const qIdx = headers.findIndex((h: string) => /question|query|input/i.test(h));
        const rIdx = headers.findIndex((h: string) => /answer|reference|output|response/i.test(h));
        if (qIdx >= 0 && rIdx >= 0) {
          rows = lines.slice(1).map((l: string) => {
            const cols = l.split(",");
            return {
              question: cols[qIdx]?.trim() ?? "",
              reference: cols.slice(rIdx).join(",").trim(), // collect remaining fields to avoid cut
            };
          }).filter((r: { question: string; reference: string }) => r.question && r.reference);
        }
      }
    } else {
      throw new Error("Unsupported file format. Use .json or .csv");
    }
  } else if (questionsFromHf) {
    const { downloadHfRows } = await import("@/server/ingestion/download");

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

  await runBenchmarkCli(datasetName, rows, docs, retrievalQuestions, args);
}

/**
 * Run the answer-quality benchmark plus the retrieval-quality gate.
 * When relevance labels are available (RagBench mode), recall/mrr are printed
 * BEFORE answer F1 so a low score is attributed to retrieval, not the LLM.
 */
async function runBenchmarkCli(
  datasetName: string,
  rows: Array<{ question: string; reference: string }>,
  docs: RagDocument[],
  retrievalQuestions: RetrievalQuestion[],
  args: Record<string, string | boolean>,
): Promise<void> {
  const topK = 4;

  // ── Retrieval gate (Layer 2) ──
  if (retrievalQuestions.length > 0) {
    const rq = evaluateRetrieval(retrievalQuestions, docs, topK);
    console.log("─ Retrieval Quality (independent of LLM) ─");
    console.log(`  Labeled questions:  ${rq.labeledCount}`);
    console.log(`  Recall@${topK}:       ${(rq.recallAtK * 100).toFixed(0)}%`);
    console.log(`  Precision@${topK}:    ${(rq.precisionAtK * 100).toFixed(0)}%`);
    console.log(`  MRR:                ${rq.mrr.toFixed(3)}`);
    for (const p of rq.perQuestion) {
      console.log(`    ${p.recall >= 1 ? "HIT " : "miss"}  q=${p.questionId}  retrieved=[${p.retrievedIds.slice(0, 3).join(", ")}]`);
    }
    console.log("");
  }

  const report = await runBenchmark(
    datasetName,
    rows,
    async (question) => {
      const retrieved = await keywordSearch(docs, question, topK);
      const result = await runRagGraphWithRetrieval(question, async () => retrieved, {
        apiKeys: {},
      });
      return { answer: result.answer };
    },
  );

  // Print report
  console.log("=".repeat(60));
  console.log(`RAG Benchmark Report — ${report.dataset}`);
  console.log("=".repeat(60));
  console.log(`Scored rows:   ${report.scoredRows}`);
  console.log(`Avg latency:   ${report.latencyMs.avg.toFixed(0)} ms/row`);
  console.log(`Total latency: ${report.latencyMs.total.toFixed(0)} ms`);
  console.log("");
  console.log("─ Answer Quality ─");
  console.log(`Token F1: ${(report.answer.tokenF1 * 100).toFixed(2)}%`);
  console.log("");

  const sorted = [...report.rows].sort((a, b) => a.answerScore - b.answerScore);

  console.log("─ Best 3 ─");
  for (const r of sorted.slice(-3).reverse()) {
    console.log(`  F1=${(r.answerScore * 100).toFixed(1)}%  ${r.latencyMs.toFixed(0)}ms  Q: ${r.question.slice(0, 80)}`);
  }
  console.log("\n─ Worst 3 ─");
  for (const r of sorted.slice(0, 3)) {
    console.log(`  F1=${(r.answerScore * 100).toFixed(1)}%  ${r.latencyMs.toFixed(0)}ms  Q: ${r.question.slice(0, 80)}`);
  }
  console.log("\n─ By Latency (slowest) ─");
  const byLatency = [...report.rows].sort((a, b) => b.latencyMs - a.latencyMs);
  for (const r of byLatency.slice(0, 3)) {
    console.log(`  ${r.latencyMs.toFixed(0)}ms  F1=${(r.answerScore * 100).toFixed(1)}%  Q: ${r.question.slice(0, 80)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});