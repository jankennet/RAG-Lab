import "dotenv/config";
import { z } from "zod";
import { createIngestedChunks } from "@/lib/chunking";
import { loadEnv, ingestionEnvSchema } from "@/lib/env";
import { fetchHuggingFaceDatasetRows } from "@/lib/hf-datasets";
import { createNimEmbeddingsModel } from "@/lib/nim";
import { createSupabaseAdminClient } from "@/lib/supabase";

const metadataFieldListSchema = z
  .string()
  .optional()
  .transform((value) => (value ?? "").split(",").map((field) => field.trim()).filter(Boolean));

const env = loadEnv(ingestionEnvSchema);
const supabase = createSupabaseAdminClient();
const embeddings = createNimEmbeddingsModel();
const metadataFields = metadataFieldListSchema.parse(env.HF_INGEST_METADATA_FIELDS);

function pickString(row: Record<string, unknown>, fieldName: string) {
  const value = row[fieldName];
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        if (entry == null) {
          return "";
        }

        if (typeof entry === "object") {
          return JSON.stringify(entry);
        }

        return String(entry);
      })
      .filter(Boolean)
      .join("\n\n");
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function buildMetadata(row: Record<string, unknown>) {
  const metadata: Record<string, unknown> = {};

  for (const field of metadataFields) {
    if (field in row) {
      metadata[field] = row[field];
    }
  }

  return metadata;
}

async function main() {
  const rows = await fetchHuggingFaceDatasetRows({
    datasetName: env.HF_DATASET_NAME,
    datasetConfig: env.HF_DATASET_CONFIG,
    split: env.HF_DATASET_SPLIT,
    limit: env.HF_DATASET_LIMIT
  });

  const documents = rows.flatMap((row, rowIndex) => {
    const title = pickString(row, env.HF_INGEST_TITLE_FIELD) || `row-${rowIndex + 1}`;
    const content = pickString(row, env.HF_INGEST_CONTENT_FIELD).trim();

    if (!content) {
      return [];
    }

    const rowId = pickString(row, env.HF_INGEST_ID_FIELD) || `${rowIndex + 1}`;
    const sourceUrl = pickString(row, env.HF_INGEST_URL_FIELD) || null;
    const metadata = buildMetadata(row);

    return createIngestedChunks({
      sourceName: env.HF_DATASET_NAME,
      sourceUrl,
      sourceKeyPrefix: `${env.HF_DATASET_NAME}:${env.HF_DATASET_CONFIG}:${env.HF_DATASET_SPLIT}:${rowId}`,
      title,
      content,
      metadata
    });
  });

  const batchSize = 32;

  for (let index = 0; index < documents.length; index += batchSize) {
    const batch = documents.slice(index, index + batchSize);
    const batchEmbeddings = await embeddings.embedDocuments(batch.map((document) => document.content));

    const payload = batch.map((document, batchIndex) => ({
      source_key: document.sourceKey,
      source_name: document.sourceName,
      source_url: document.sourceUrl,
      title: document.title,
      content: document.content,
      metadata: document.metadata,
      chunk_index: document.chunkIndex,
      embedding: batchEmbeddings[batchIndex]
    }));

    const { error } = await supabase.from("rag_documents").upsert(payload, {
      onConflict: "source_key,chunk_index"
    });

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    console.log(`Ingested ${Math.min(index + batch.length, documents.length)} / ${documents.length} chunks`);
  }

  console.log(`Done. Rows: ${rows.length}. Chunks: ${documents.length}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});