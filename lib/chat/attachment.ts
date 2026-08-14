import { smartChunkText, createDataset, updateDatasetChunks, makeDocuments, type OpfsDocument } from "@/client/opfs";
import type { ChatAttachment, RagDocument } from "@/shared/types";
import { v4 as uuidv4 } from "uuid";

export const TEXT_EXTS = new Set([".txt", ".md", ".text", ".rst", ".html", ".htm", ".xml", ".csv", ".json", ".jsonl", ".sql"]);
export const OCR_HINT_EXTS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"]);

export function fileExt(name: string): string {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

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