// Pure helpers for the chat attachment + submit flow — React-free.
// Lifted from app/(dashboard)/components/ChatView.tsx:
//   - buildAttachmentDocs (L32-57) — turns thread attachments into RAG documents.
//   - readErrorMessage (L171-194) — resistencia-safe error-body extraction.
// Moved here so the (Phase 8) submit/ingest hooks can compose already-validated code.

import { smartChunkText } from "@/client/opfs";
import type { ChatAttachment, RagDocument } from "@/shared/types";

/** Chunk every attachment and emit RagDocument[] for the retrieval-augmented chat request. */
export function buildAttachmentDocs(threadId: string, attachments: ChatAttachment[]): RagDocument[] {
  const docs: RagDocument[] = [];

  attachments.forEach((attachment, attachmentIndex) => {
    const chunks = smartChunkText(attachment.content, { chunkSize: 1200, chunkOverlap: 150 });
    chunks.forEach((chunk, chunkIndex) => {
      docs.push({
        id: attachmentIndex * 1000 + chunkIndex,
        sourceKey: `${threadId}:attachment:${attachmentIndex}:${chunkIndex}`,
        sourceName: attachment.name,
        sourceUrl: null,
        title: chunks.length > 1 ? `${attachment.name} — chunk ${chunkIndex + 1}` : attachment.name,
        content: chunk,
        metadata: {
          attachmentId: attachment.id,
          ocrEnabled: attachment.ocrEnabled,
          requiresOcr: attachment.requiresOcr,
          createdAt: attachment.createdAt,
        },
        chunkIndex,
      });
    });
  });

  return docs;
}

/** Extract a human-readable error message from a fetch Response, preferring `application/json` `{error}` then text. */
export async function readErrorMessage(response: Response): Promise<string> {
  const statusText = response.statusText || "Internal Server Error";
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      if (typeof data?.error === "string" && data.error.trim()) {
        return data.error.trim();
      }
    } catch {
      // fall through
    }
  }

  try {
    const text = await response.text();
    if (text.trim()) return text.trim();
  } catch {
    // fall through
  }

  return `HTTP ${response.status} ${statusText}`.trim();
}

// Re-exports for convenience so hooked callers import from one place.
export type { ChatAttachment, RagDocument };
