import { createNimEmbeddingsModel } from "@/lib/nim";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { RagDocument } from "@/lib/types";

type MatchDocumentRow = {
  id: number;
  source_key: string;
  source_name: string;
  source_url: string | null;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  chunk_index: number;
  similarity: number;
};

export async function retrieveDocuments(question: string, topK = 4): Promise<RagDocument[]> {
  const supabase = createSupabaseAdminClient();
  const embeddings = createNimEmbeddingsModel();
  const queryEmbedding = await embeddings.embedQuery(question);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: topK,
    source_name_filter: null
  });

  if (error) {
    throw new Error(`Supabase match_documents failed: ${error.message}`);
  }

  return ((data ?? []) as MatchDocumentRow[]).map((row) => ({
    id: row.id,
    sourceKey: row.source_key,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    title: row.title,
    content: row.content,
    metadata: row.metadata ?? {},
    chunkIndex: row.chunk_index,
    similarity: row.similarity
  }));
}