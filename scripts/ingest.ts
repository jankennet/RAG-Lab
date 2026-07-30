/**
 * Universal dataset ingestion CLI.
 *
 * Usage:
 *   tsx scripts/ingest.ts --url <dataset-url> [options]
 *   tsx scripts/ingest.ts --file <local-file.csv> [options]
 *
 * Examples:
 *   tsx scripts/ingest.ts --url https://huggingface.co/datasets/galileo-ai/ragbench
 *   tsx scripts/ingest.ts --url https://example.com/data.csv --content-field description
 *   tsx scripts/ingest.ts --file ./kaggle_download.csv --content-field Card_ID --title-field Card_Type
 */
import "dotenv/config";
import { existsSync } from "fs";
import { runIngestion } from "@/server/ingestion";

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const map: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
      if (val !== "true") i++;
      map[key] = val;
    }
  }
  return map;
}

async function main() {
  const args = parseArgs();
  const url = args.url || "";
  const file = args.file || "";

  if (!url && !file) {
    console.error("Usage: tsx scripts/ingest.ts --url <dataset-url> [options]");
    console.error("  or:  tsx scripts/ingest.ts --file <local-file.csv> [options]");
    console.error("");
    console.error("Options:");
    console.error("  --url              Dataset URL");
    console.error("  --file             Local CSV/JSON file path");
    console.error("  --content-field    Column name for document content");
    console.error("  --title-field      Column name for document title");
    console.error("  --id-field         Column name for row ID");
    console.error("  --url-field        Column name for source URL");
    console.error("  --metadata-fields  Comma-separated metadata column names");
    console.error("  --chunk-size       Max chars per chunk (default 1000)");
    console.error("  --chunk-overlap    Overlap between chunks (default 150)");
    console.error("  --max-rows         Max rows to ingest (default 200)");
    console.error("  --embedding-dim    Embedding dimension (default 1024)");
    console.error("");
    console.error("NIM_API_KEY must be set in .env or environment.");
    process.exitCode = 1;
    return;
  }

  if (file && !existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.NIM_API_KEY;
  if (!apiKey) {
    console.error("NIM_API_KEY required in .env or environment");
    process.exitCode = 1;
    return;
  }

  const metadataFields = args["metadata-fields"]
    ? args["metadata-fields"].split(",").map((s: string) => s.trim()).filter(Boolean)
    : undefined;

  console.log(`Ingesting: ${file || url}`);
  const result = await runIngestion({
    url,
    file: file || undefined,
    contentField: args["content-field"],
    titleField: args["title-field"],
    idField: args["id-field"],
    urlField: args["url-field"],
    metadataFields,
    chunkSize: args["chunk-size"] ? Number(args["chunk-size"]) : undefined,
    chunkOverlap: args["chunk-overlap"] ? Number(args["chunk-overlap"]) : undefined,
    maxRows: args["max-rows"] ? Number(args["max-rows"]) : 200,
    embeddingDim: args["embedding-dim"] ? Number(args["embedding-dim"]) : undefined,
    apiKey,
  });

  console.log(`\nDone. Rows: ${result.rows}, Chunks: ${result.chunks}`);
  console.log(`Saved to: ${result.dir}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});