import { useCallback } from "react";
import type { ChatThread, LlmProvider } from "@/shared/types";
import { buildAttachmentDocs, readErrorMessage } from "@/lib/chat/attachment";
import { searchDocuments, summarizeChatTitle } from "@/client/opfs";

interface UseChatSubmitProps {
  thread: ChatThread | null;
  input: string;
  isLoading: boolean;
  persistThread: (nextThread: ChatThread) => Promise<void>;
  preferences: {
    provider: LlmProvider;
    model: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    topK?: number;
    activeDatasetId: string | null;
  };
  apiKeyStatus: Record<string, { hasKey: boolean }>;
}

export function useChatSubmit({
  thread,
  input,
  isLoading,
  persistThread,
  preferences,
  apiKeyStatus,
}: UseChatSubmitProps) {
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading || !thread) return;

      const keyStatus = apiKeyStatus[preferences.provider];
      if (!keyStatus?.hasKey) {
        // This is handled by the view via missingKeyProvider, but we can return early
        return;
      }

      const userMessage = {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: input.trim(),
        timestamp: Date.now(),
      };

      const nextMessages = [...(thread.messages ?? []), userMessage];
      const nextTitle =
        thread.title === "New chat" && !thread.messages.some((message) => message.role === "user")
          ? summarizeChatTitle(userMessage.content)
          : thread.title;

      const draftThread = {
        ...thread,
        title: nextTitle,
        messages: nextMessages,
        updatedAt: Date.now(),
      };

      await persistThread(draftThread);
      // Note: In the original, setInput("") is called here, but we'll let the view handle resetting input
      // We'll expose a callback to reset input or let the view do it after submit.
      // For now, we'll not reset input here; the view will do it after calling this.
      // We'll return a flag to indicate that input should be reset.
      // Alternatively, we can have the view call a reset function.
      // Let's change: we'll not reset input here, but the view will set input to "" after calling handleSubmit.
      // We'll leave it to the view.

      try {
        const topK = preferences.topK ?? 4;
        const retrievalDocs =
          draftThread.scope === "dataset"
            ? await searchDocuments(draftThread.datasetId || preferences.activeDatasetId || null, userMessage.content, topK)
            : draftThread.scope === "all"
              ? await searchDocuments(null, userMessage.content, topK)
              : [];

        const attachmentDocs = buildAttachmentDocs(draftThread.id, draftThread.attachments);
        const documents = [...attachmentDocs, ...retrievalDocs];

        // Simulate setting loading phases - we'll let the view handle loading state via props
        // We'll expose a callback to set loading or let the view manage it.
        // For simplicity, we'll assume the view sets loading before calling this and unsets after.
        // We'll not manage loading state here.

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: userMessage.content,
            temperature: preferences.temperature ?? 0.2,
            topP: preferences.topP ?? 0.9,
            maxTokens: preferences.maxTokens ?? 4096,
            provider: preferences.provider,
            model: preferences.model,
            documents,
            topK: Math.max(topK, documents.length),
            datasetId: draftThread.scope === "dataset" ? (draftThread.datasetId || preferences.activeDatasetId || undefined) : undefined,
            scope: draftThread.scope,
            conversationHistory: thread.messages.map((message) => ({ role: message.role, content: message.content })),
          }),
        });

        if (!response.ok) {
          const errorMessage = await readErrorMessage(response);
          const errorThread = {
            ...draftThread,
            messages: [
              ...draftThread.messages,
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: `Error: ${errorMessage}`,
                timestamp: Date.now(),
                kind: "error" as const,
              },
            ],
            updatedAt: Date.now(),
          };
          await persistThread(errorThread);
          return;
        }

        const data = await response.json();
        const assistantMessage = {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: data.answer,
          timestamp: Date.now(),
          sources: data.documents ?? [],
          kind: "normal" as const,
        };

        await persistThread({
          ...draftThread,
          messages: [...draftThread.messages, assistantMessage],
          updatedAt: Date.now(),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown chat error";
        await persistThread({
          ...draftThread,
          messages: [
            ...draftThread.messages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `Error: ${errorMessage}`,
              timestamp: Date.now(),
              kind: "error",
            },
          ],
          updatedAt: Date.now(),
        });
      } finally {
        // We'll let the view set loading to false after this promise resolves
        // We can return a promise that resolves when done, and the view can set loading then.
        // For now, we'll not manage loading state here.
      }
    },
    [thread, input, isLoading, persistThread, preferences, apiKeyStatus],
  );

  // We'll return the handleSubmit function and a resetInput callback if needed
  // But note: the original handleSubmit also setInput("") after persisting the draftThread.
  // We'll let the view do that after calling handleSubmit.
  // We'll return a function that the view can call to reset input, or we can have the view set input to "" after submit.
  // Let's return a resetInput function that sets input to "" (but we don't have setInput in this hook's scope).
  // We'll change: we'll move the setInput("") inside the hook after persisting the draftThread, but we need a setter.
  // We'll adjust the hook to accept a setInput setter.

  // Given the complexity, let's instead keep the input state in the view and have the hook return the submit function
  // and the view will handle resetting input after the submit promise resolves.

  // We'll return only the handleSubmit function for now.
  return { handleSubmit };
}