"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDashboard } from "./components/DashboardProvider";
import { Skeleton } from "./components/Skeleton";

export default function DashboardHome() {
  const router = useRouter();
  const { chatThreads, createDraftChatThread, activeChatId, mounted } = useDashboard();

  // The chat view renders on its own route (/chats/[id]). This room is the
  // doorway: if a chat is already active, send the viewer straight to it.
  useEffect(() => {
    if (activeChatId) {
      router.replace(`/chats/${activeChatId}`);
    }
  }, [activeChatId, router]);

  const handleNewChat = () => {
    const thread = createDraftChatThread({ title: "New chat", scope: "chat", datasetId: null });
    router.push(`/chats/${thread.id}`);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
        <h1 className="text-3xl font-semibold text-text tracking-tight">RAG Lab</h1>
        <p className="mt-2 text-sm text-muted max-w-md">
          Ask against your datasets, run benchmarks, and compare models.
          Pick a conversation below or start a new one.
        </p>
        <button
          onClick={handleNewChat}
          className="mt-8 inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-accent text-[#03111a] rounded-2xl hover:bg-accent-hover transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 1v12M1 7h12" />
          </svg>
          New chat
        </button>
      </div>

      <div className="max-w-3xl w-full mx-auto px-6 pb-10">
        <h2 className="text-xs font-semibold text-muted tracking-wider uppercase mb-3">Recent chats</h2>
        <div className="space-y-2">
          {!mounted ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : chatThreads.length === 0 ? (
            <p className="text-sm text-muted bg-panel/40 border border-line rounded-xl px-4 py-3">
              No conversations yet. Start a new chat to ask about your datasets.
            </p>
          ) : null}
          {chatThreads.map((thread) => (
            <Link
              key={thread.id}
              href={`/chats/${thread.id}`}
              className="flex items-center gap-3 rounded-xl border border-line bg-panel/40 px-4 py-3 hover:border-accent/30 transition-colors"
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${thread.id === activeChatId ? "bg-accent" : "bg-line"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text font-medium">{thread.title}</p>
                <p className="text-[11px] text-muted truncate">
                  {thread.scope === "chat" ? "Chat" : thread.scope === "dataset" ? "Dataset" : "All datasets"}
                  {" · "}{thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}