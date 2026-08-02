/**
 * ROS-aligned chunker with strategy pattern.
 *
 * Strategies:
 *   FixedSizeChunker  — token/char window with overlap (fallback)
 *   RecursiveChunker  — markdown headers → paragraphs → sentences → fixed
 *   StructuredChunker — JSON fields → key-value chunks
 *
 * Auto-detect: structured JSON → StructuredChunker, prose → RecursiveChunker.
 *
 * Interface matches ROS spec:
 *   interface Chunker { chunk(document): Chunk[] }
 */

import type { IngestedRow } from "@/shared/types";

// ── Types ──────────────────────────────────────────────────────────

export type DocumentType = "unstructured" | "structured";

export interface ChunkerOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export interface Chunker {
  readonly name: string;
  split(text: string, options?: Partial<ChunkerOptions>): string[];
}

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULTS: ChunkerOptions = { chunkSize: 1000, chunkOverlap: 150 };
const STRUCTURED_CHUNK_SIZE = 800;
const MIN_CHUNK_LENGTH = 20;

// ── Fixed Size ─────────────────────────────────────────────────────

export class FixedSizeChunker implements Chunker {
  readonly name = "fixed";

  split(text: string, options?: Partial<ChunkerOptions>): string[] {
    const { chunkSize, chunkOverlap } = { ...DEFAULTS, ...options };
    const normalized = text.replace(/\s+/g, " ").trim();

    if (normalized.length <= chunkSize) {
      return [normalized];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < normalized.length) {
      const end = Math.min(normalized.length, start + chunkSize);
      chunks.push(normalized.slice(start, end).trim());
      if (end >= normalized.length) break;
      start = Math.max(0, end - chunkOverlap);
    }

    return chunks.filter((c) => c.length >= MIN_CHUNK_LENGTH);
  }
}

// ── Recursive (structure-aware) ────────────────────────────────────

/**
 * Split on semantic boundaries in order:
 *   1. Markdown headers (##, ###)
 *   2. Double newlines (paragraphs)
 *   3. Sentence endings (.!?)
 *   4. Fixed-size (fallback)
 *
 * Each stage only runs if its predecessor produced chunks over chunkSize.
 */
export class RecursiveChunker implements Chunker {
  readonly name = "recursive";

  private readonly separators = [
    /\n#{2,3}\s+/,
    /\n\n+/,
    /(?<=[.!?])\s+/,
  ];

  split(text: string, options?: Partial<ChunkerOptions>): string[] {
    const { chunkSize, chunkOverlap } = { ...DEFAULTS, ...options };
    const cleaned = text.replace(/\r\n/g, "\n").trim();
    if (!cleaned) return [];

    return this.recursiveSplit(cleaned, 0, chunkSize, chunkOverlap);
  }

  private recursiveSplit(
    text: string,
    depth: number,
    chunkSize: number,
    chunkOverlap: number,
  ): string[] {
    // Base: fixed-size split
    if (depth >= this.separators.length || text.length <= chunkSize) {
      return new FixedSizeChunker().split(text, { chunkSize, chunkOverlap });
    }

    const sep = this.separators[depth];
    const parts = text.split(sep).filter((p) => p.trim().length >= MIN_CHUNK_LENGTH);

    // If splitting produced only one part, try next depth
    if (parts.length <= 1) {
      return this.recursiveSplit(text, depth + 1, chunkSize, chunkOverlap);
    }

    // Greedy-merge until each chunk fits under chunkSize
    const merged: string[] = [];
    let buffer = "";

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      if ((buffer + "\n\n" + trimmed).length <= chunkSize) {
        buffer = buffer ? buffer + "\n\n" + trimmed : trimmed;
      } else {
        if (buffer) merged.push(buffer);
        buffer = trimmed;
      }
    }
    if (buffer) merged.push(buffer);

    // Recurse on any chunk still over threshold
    return merged.flatMap((chunk) =>
      chunk.length > chunkSize * 1.5
        ? this.recursiveSplit(chunk, depth + 1, chunkSize, chunkOverlap)
        : [chunk],
    );
  }
}

// ── Structured (JSON / tabular) ────────────────────────────────────

/**
 * Parse JSON content into logical field-group chunks.
 * Each object key gets its own chunk with a label header.
 */
export class StructuredChunker implements Chunker {
  readonly name = "structured";

  split(text: string, options?: Partial<ChunkerOptions>): string[] {
    const chunkSize = options?.chunkSize ?? DEFAULTS.chunkSize;

    const parsed = this.tryParse(text);
    if (!parsed) {
      return new RecursiveChunker().split(text, { chunkSize, chunkOverlap: 0 });
    }

    if (Array.isArray(parsed)) {
      return this.chunkArray(parsed, chunkSize);
    }

    return this.chunkObject(parsed as Record<string, unknown>, chunkSize);
  }

  private tryParse(text: string): unknown | null {
    // Only attempt if it looks like JSON
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  private chunkObject(obj: Record<string, unknown>, maxSize: number): string[] {
    const chunks: string[] = [];
    let buffer = "";

    for (const [key, value] of Object.entries(obj)) {
      if (value == null) continue;
      const entry = this.serializeEntry(key, value);
      if (!entry) continue;

      if ((buffer + "\n" + entry).length > maxSize && buffer) {
        chunks.push(buffer.trim());
        buffer = "";
      }
      buffer = buffer ? buffer + "\n" + entry : entry;
    }
    if (buffer) chunks.push(buffer.trim());

    return chunks.filter((c) => c.length >= MIN_CHUNK_LENGTH);
  }

  private chunkArray(arr: unknown[], maxSize: number): string[] {
    const chunks: string[] = [];
    let buffer = "";

    for (let i = 0; i < arr.length; i++) {
      const entry = this.serializeEntry(`[${i}]`, arr[i]);
      if (!entry) continue;

      if ((buffer + "\n" + entry).length > maxSize && buffer) {
        chunks.push(buffer.trim());
        buffer = "";
      }
      buffer = buffer ? buffer + "\n" + entry : entry;
    }
    if (buffer) chunks.push(buffer.trim());

    return chunks.filter((c) => c.length >= MIN_CHUNK_LENGTH);
  }

  private serializeEntry(key: string, value: unknown): string | null {
    if (value == null) return null;
    const displayKey = key.replace(/_/g, " ");
    if (typeof value === "string") return `**${displayKey}**: ${value}`;
    if (typeof value === "number" || typeof value === "boolean") return `**${displayKey}**: ${value}`;
    if (Array.isArray(value)) return `**${displayKey}**: ${value.map(String).join(", ")}`;
    return `**${displayKey}**: ${JSON.stringify(value)}`;
  }
}

// ── Document type detection ────────────────────────────────────────

export function detectDocumentType(content: string): DocumentType {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return "structured";
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return "structured";
  return "unstructured";
}

// ── Chunker selection ──────────────────────────────────────────────

export function selectChunker(
  documentType?: DocumentType,
  chunkerName?: string,
  content?: string,
): Chunker {
  if (chunkerName) {
    switch (chunkerName) {
      case "fixed":  return new FixedSizeChunker();
      case "recursive": return new RecursiveChunker();
      case "structured": return new StructuredChunker();
    }
  }

  const detected = documentType ?? (content ? detectDocumentType(content) : "unstructured");

  if (detected === "structured") return new StructuredChunker();
  return new RecursiveChunker(); // default for prose
}

// ── High-level factory ─────────────────────────────────────────────

export interface CreateChunksParams {
  sourceName: string;
  sourceUrl: string | null;
  sourceKeyPrefix: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  documentType?: DocumentType;
  chunkerName?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export function createChunks(params: CreateChunksParams): IngestedRow[] {
  const chunker = selectChunker(params.documentType, params.chunkerName, params.content);
  const rawChunks = chunker.split(params.content, {
    chunkSize: params.chunkSize,
    chunkOverlap: params.chunkOverlap,
  });

  return rawChunks.map<IngestedRow>((content, chunkIndex) => ({
    sourceKey: `${params.sourceKeyPrefix}:${chunkIndex}`,
    sourceName: params.sourceName,
    sourceUrl: params.sourceUrl,
    title: params.title,
    content,
    metadata: params.metadata,
    chunkIndex,
  }));
}

// ── Legacy compat (backward-compatible exports) ────────────────────

export function splitText(text: string, maxLength = 1000, overlap = 150): string[] {
  return new FixedSizeChunker().split(text, { chunkSize: maxLength, chunkOverlap: overlap });
}

export function createIngestedChunks(params: CreateChunksParams): IngestedRow[] {
  return createChunks(params);
}