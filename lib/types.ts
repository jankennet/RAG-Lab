export type RagDocument = {
  id: number;
  sourceKey: string;
  sourceName: string;
  sourceUrl: string | null;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  chunkIndex: number;
  similarity?: number;
};

export type ChatRequest = {
  question: string;
  topK?: number;
};

export type ChatResponse = {
  answer: string;
  documents: RagDocument[];
};

export type IngestedRow = {
  sourceKey: string;
  sourceName: string;
  sourceUrl: string | null;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  chunkIndex: number;
};