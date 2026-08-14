"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChatThread } from "../hooks/useChatThread";
import { useChatSubmit } from "../hooks/useChatSubmit";
import { useAttachmentIngest } from "../hooks/useAttachmentIngest";
import ChatTopBar from "./chat/ChatTopBar";
import InferenceControls from "./chat/InferenceControls";
import MessageList from "./chat/MessageList";
import ChatInputArea from "./chat/ChatInputArea";
import ApiKeyMissingToast from "./ApiKeyMissingToast";
import type { ChatThread, ChatScope, LlmProvider, ChatAttachment, RagDocument } from "@/shared/types";
import { loadIndex, loadChatThread } from "@/client/opfs";
import { v4 as uuidv4 } from "uuid";
import { ChatConversationSkeleton } from "./Skeleton";
import { summarizeChatTitle } from "@/client/opfs";


export default function ChatView({ chatId }: { chatId: string }) {
  const {
    thread,
    input,
    setInput,
    useOcr,
    setUseOcr,
    isLoading,
    setIsLoading,
    loadingPhase,
    setLoadingPhase,
    showInference,
    setShowInference,
    missingKeyProvider,
    setMissingKeyProvider,
    datasets,
    setDatasets,
    attachmentNotice,
    setAttachmentNotice,
    isDragging,
    setIsDragging,
    persistThread,
    updateThread,
    handleThreadScopeChange,
    handleDatasetChange,
    apiKeyStatus,
    preferences,
    setProvider,
    setModel,
    setTopK,
    setTemperature,
    setTopP,
    setMaxTokens,
    refreshChatThreads: refreshChatThreadsFn,
    chatThreads: allChatThreads,
  } = useChatThread(chatId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentScope = thread?.scope ?? "chat";
  const currentAttachments = thread?.attachments ?? [];
  const currentMessages = thread?.messages ?? [];

  // Load datasets on mount
  useEffect(() => {
    loadIndex().then(setDatasets).catch(() => {});
  }, []);

  // Update active dataset when thread scope changes
  useEffect(() => {
    if (thread?.scope === "dataset" && thread.datasetId) {
      // This is handled by the hook, but we can keep it for safety
    }
  }, [thread?.datasetId, thread?.scope]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, isLoading]);

  // Handle attachment notice timeout
  useEffect(() => {
    if (!attachmentNotice) return;
    const timer = window.setTimeout(() => setAttachmentNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [attachmentNotice]);

  // Handle API key missing status
  useEffect(() => {
    const status = apiKeyStatus[preferences.provider];
    if (status && !status.hasKey) {
      setMissingKeyProvider(preferences.provider);
    }
  }, [apiKeyStatus, preferences.provider]);

  // Extract functions from hooks
  const {
    handleSubmit: handleChatSubmit,
  } = useChatSubmit({
    thread,
    input,
    isLoading,
    persistThread,
    preferences,
    apiKeyStatus,
  });

  const {
    handleAttachFiles: handleAttachmentIngest,
  } = useAttachmentIngest({
    thread,
    currentAttachments,
    useOcr,
    persistThread,
    setAttachmentNotice,
  });

  const handleAttachFiles = useCallback(async (files: File[]) => {
    await handleAttachmentIngest(files);
    // Reset file input after processing
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [handleAttachmentIngest, fileInputRef]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      await handleChatSubmit(e);
      // Reset input after submit
      setInput("");
    },
    [handleChatSubmit, setInput],
  );

  const handleProviderChange = useCallback((provider: LlmProvider) => {
    setProvider(provider);
  }, [setProvider]);

  const handleModelChange = useCallback((model: string) => {
    setModel(model);
  }, [setModel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  if (!thread) {
    return <ChatConversationSkeleton />;
  }

  return (
    <div className="flex flex-col h-full relative">
      {missingKeyProvider && (
        <ApiKeyMissingToast
          provider={missingKeyProvider}
          onDismiss={() => setMissingKeyProvider(null)}
        />
      )}

      <ChatTopBar
        provider={preferences.provider}
        model={preferences.model}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        missingKeyProvider={missingKeyProvider}
        onDismissMissingKey={() => setMissingKeyProvider(null)}
        currentScope={currentScope}
        onScopeChange={handleThreadScopeChange}
        activeDatasetId={preferences.activeDatasetId}
        onDatasetChange={handleDatasetChange}
        datasets={datasets.map((ds) => ({ id: ds.id, name: ds.name }))}
        showInference={showInference}
        onToggleInference={() => setShowInference((v) => !v)}
        threadTitle={thread.title}
        threadScope={thread.scope}
      />

      {showInference && (
        <InferenceControls
          showInference={showInference}
          onToggleInference={() => setShowInference((v) => !v)}
          preferences={{
            topK: preferences.topK,
            temperature: preferences.temperature,
            topP: preferences.topP,
            maxTokens: preferences.maxTokens,
          }}
          setTopK={setTopK}
          setTemperature={setTemperature}
          setTopP={setTopP}
          setMaxTokens={setMaxTokens}
        />
      )}

      <MessageList
        currentMessages={currentMessages}
        isLoading={isLoading}
        isDragging={isDragging}
        loadingPhase={loadingPhase}
        messagesEndRef={messagesEndRef}
        handleAttachFiles={handleAttachFiles}
        setInput={setInput}
        input={input}
        handleKeyDown={handleKeyDown}
        currentAttachments={currentAttachments}
        removeAttachment={async (attachmentId: string) => {
          await updateThread((current) => ({
            ...current,
            attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
            updatedAt: Date.now(),
          }));
        }}
        attachmentNotice={attachmentNotice}
        setAttachmentNotice={setAttachmentNotice}
        useOcr={useOcr}
        setUseOcr={setUseOcr}
        fileInputRef={fileInputRef}
        currentScope={currentScope}
        threadTitle={thread.title}
        thread={thread}
      />

      <ChatInputArea
        attachmentNotice={attachmentNotice}
        setAttachmentNotice={setAttachmentNotice}
        currentAttachments={currentAttachments}
        removeAttachment={async (attachmentId: string) => {
          await updateThread((current) => ({
            ...current,
            attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
            updatedAt: Date.now(),
          }));
        }}
        useOcr={useOcr}
        setUseOcr={setUseOcr}
        fileInputRef={fileInputRef}
        handleAttachFiles={handleAttachFiles}
        handleSubmit={handleSubmit}
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        currentScope={currentScope}
        handleKeyDown={handleKeyDown}
      />
    </div>
  );
}