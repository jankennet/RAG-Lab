import type { IngestedRow } from "@/lib/types";

export function splitText(text: string, maxLength = 1000, overlap = 150) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + maxLength);
    chunks.push(normalized.slice(start, end).trim());

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - overlap);
  }

  return chunks.filter(Boolean);
}

export function createIngestedChunks(params: {
  sourceName: string;
  sourceUrl: string | null;
  sourceKeyPrefix: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}) {
  const chunks = splitText(params.content);

  return chunks.map<IngestedRow>((chunk, chunkIndex) => ({
    sourceKey: `${params.sourceKeyPrefix}:${chunkIndex}`,
    sourceName: params.sourceName,
    sourceUrl: params.sourceUrl,
    title: params.title,
    content: chunk,
    metadata: params.metadata,
    chunkIndex
  }));
}