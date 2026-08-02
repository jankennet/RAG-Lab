import type { RagDocument } from "@/shared/types";

const RAG_SERVICE_URL = "http://127.0.0.1:8001";

export type RetrievedDoc = {
  source_key: string;
  source_name: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type RetrieveResponse = {
  results: RetrievedDoc[];
  total_chunks_searched: number;
};

export type IngestResponse = {
  source_name: string;
  row_count: number;
  chunk_count: number;
  column_count: number;
  columns: Array<{ name: string; dtype: string; min?: number; max?: number; mean?: number }>;
  chunks: Array<{
    source_key: string;
    source_name: string;
    title: string;
    content: string;
    chunk_type: string;
    metadata: Record<string, unknown>;
  }>;
};

export async function retrieveFromPythonService(
  query: string,
  datasetDir?: string,
  chunksData?: Array<Record<string, unknown>>,
  topK = 10,
): Promise<RetrieveResponse | null> {
  try {
    const res = await fetch(`${RAG_SERVICE_URL}/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        query,
        top_k: Math.min(topK, 200),
        dataset_dir: datasetDir,
        chunks_data: chunksData,
        use_keyword_fallback: true,
      }),
    });

    if (!res.ok) {
      console.warn("[retrieval-client] Python service returned", res.status);
      return null;
    }

    return (await res.json()) as RetrieveResponse;
  } catch (err) {
    console.warn("[retrieval-client] Python service unreachable:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function ingestViaPythonService(
  csvContent: string,
  sourceName?: string,
  maxRows = 5000,
): Promise<IngestResponse | null> {
  try {
    const res = await fetch(`${RAG_SERVICE_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        csv_content: csvContent,
        source_name: sourceName,
        max_rows: maxRows,
        generate_summaries: true,
      }),
    });

    if (!res.ok) {
      console.warn("[retrieval-client] Python ingest returned", res.status);
      return null;
    }

    return (await res.json()) as IngestResponse;
  } catch (err) {
    console.warn("[retrieval-client] Python ingest unreachable:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function toRagDocuments(results: RetrievedDoc[]): RagDocument[] {
  return results.map((doc, i) => ({
    id: i,
    sourceKey: doc.source_key,
    sourceName: doc.source_name,
    sourceUrl: null,
    title: doc.title,
    content: doc.content,
    metadata: doc.metadata,
    chunkIndex: i,
    similarity: doc.similarity,
  }));
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${RAG_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}