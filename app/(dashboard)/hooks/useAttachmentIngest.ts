import { useCallback } from "react";
import type { ChatThread, ChatAttachment } from "@/shared/types";
import { fileExt, TEXT_EXTS, OCR_HINT_EXTS } from "@/app/(dashboard)/lib/datasets/fileExts";
import { smartChunkText, createDataset, updateDatasetChunks, makeDocuments, type OpfsDocument } from "@/client/opfs";
import { v4 as uuidv4 } from "uuid";

interface UseAttachmentIngestProps {
  thread: ChatThread | null;
  currentAttachments: ChatAttachment[];
  useOcr: boolean;
  persistThread: (nextThread: ChatThread) => Promise<void>;
  setAttachmentNotice: (notice: string | null) => void;
}

export function useAttachmentIngest({
  thread,
  currentAttachments,
  useOcr,
  persistThread,
  setAttachmentNotice,
}: UseAttachmentIngestProps) {
  const handleAttachFiles = useCallback(
    async (files: File[]) => {
      if (!thread || files.length === 0) return;

      setAttachmentNotice(null);

      try {
        const form = new FormData();
        form.set("ocr", String(useOcr));

        const textAttachments: ChatAttachment[] = [];
        const binaryFiles: File[] = [];

        for (const file of files) {
          const ext = fileExt(file.name);
          if (TEXT_EXTS.has(ext)) {
            const raw = await file.text();
            let content = raw;
            if (ext === ".json") {
              try {
                content = JSON.stringify(JSON.parse(raw), null, 2);
              } catch {
                // keep raw
              }
            }
            textAttachments.push({
              id: uuidv4(),
              name: file.name,
              content,
              metadata: { fileType: ext.slice(1), source: "chat-upload" },
              requiresOcr: false,
              ocrEnabled: useOcr,
              createdAt: Date.now(),
            });
          } else {
            binaryFiles.push(file);
          }
        }

        if (binaryFiles.length > 0) {
          for (const file of binaryFiles) {
            form.append("files", file);
          }

          const response = await fetch("/api/upload", { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(typeof data.error === "string" ? data.error : "Failed to parse uploaded files");
          }

          const parsedFiles = (data as { files?: Array<{ filename: string; content: string; metadata: Record<string, unknown> }> }).files ?? [];
          for (const file of parsedFiles) {
            const ext = fileExt(file.filename);
            textAttachments.push({
              id: uuidv4(),
              name: file.filename,
              content: file.content,
              metadata: file.metadata ?? { fileType: ext.slice(1), source: "chat-upload" },
              requiresOcr: OCR_HINT_EXTS.has(ext),
              ocrEnabled: useOcr,
              createdAt: Date.now(),
            });
          }
        }

        if (textAttachments.length === 0) {
          throw new Error("No files could be parsed.");
        }

        let autoDatasetId: string | null = null;
        try {
          const dataset = await createDataset({
            name: `Chat upload — ${new Date().toLocaleDateString()} (${textAttachments.length} files)`,
            source: "upload",
          });
          const allChunks: OpfsDocument[] = [];
          for (const attachment of textAttachments) {
            const chunks = smartChunkText(attachment.content, { chunkSize: 1200, chunkOverlap: 150 });
            const docs = makeDocuments(
              attachment.name,
              null,
              attachment.name,
              chunks,
              { attachmentId: attachment.id, fileType: attachment.metadata.fileType, source: "chat-upload" },
            );
            allChunks.push(...docs);
          }
          if (allChunks.length > 0) {
            await updateDatasetChunks(dataset.id, allChunks);
          }
          autoDatasetId = dataset.id;
        } catch (err) {
          console.warn("[attach] auto-ingest failed:", err);
        }

        // Preserve the user's selected scope — attaching/ingesting a file is data,
        // not a scope change. The upload dataset is still linked (datasetId) so a
        // later switch to Dataset/All datasets can query it, but the dropdown stays
        // where the user left it (e.g. "Chat").
        const nextThread: ChatThread = {
          ...thread,
          attachments: [...currentAttachments, ...textAttachments],
          scope: thread.scope,
          datasetId: autoDatasetId ?? thread.datasetId,
          updatedAt: Date.now(),
        };

        await persistThread(nextThread);
        setAttachmentNotice(
          `${textAttachments.length} file${textAttachments.length === 1 ? "" : "s"} attached.${autoDatasetId ? " Ingested for RAG." : ""}`
        );
      } catch (error) {
        setAttachmentNotice(error instanceof Error ? error.message : "Failed to attach files");
      }
    },
    [thread, currentAttachments, useOcr, persistThread, setAttachmentNotice],
  );

  return { handleAttachFiles };
}