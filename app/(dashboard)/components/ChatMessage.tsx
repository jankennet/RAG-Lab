"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { RagDocument } from "@/shared/types";

interface ChatMessageProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    sources?: RagDocument[];
  };
}

/** Block dangerous URL schemes that could execute JavaScript or exfiltrate data. */
function safeUrl(url: string): string {
  if (!url) return "";
  const lowered = url.trim().toLowerCase();
  if (
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:") ||
    lowered.startsWith("vbscript:") ||
    lowered.startsWith("file:")
  ) {
    return "";
  }
  return url;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full mb-6 ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "order-1" : "order-1"}`}>
        {/* Role label */}
        <div className={`text-xs font-medium mb-1.5 ${isUser ? "text-right text-muted" : "text-left text-accent"}`}>
          {isUser ? "You" : "Assistant"}
        </div>

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-accent/10 border border-accent/20 rounded-br-md text-text"
              : "bg-bg-alt border border-line rounded-bl-md text-text"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources toggle (assistant only) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
            >
              <span className={`transition-transform ${sourcesOpen ? "rotate-90" : ""}`}>▸</span>
              {message.sources.length} source{message.sources.length > 1 ? "s" : ""}
            </button>

            {sourcesOpen && (
              <div className="mt-2 space-y-2">
                {message.sources.map((source, i) => (
                  <div
                    key={source.id}
                    className="bg-bg-alt border border-line rounded-xl p-3 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-text truncate max-w-[70%]">
                        {source.title || `Chunk ${source.chunkIndex}`}
                      </span>
                      <span className="text-muted">
                        {source.similarity !== undefined
                          ? `${(source.similarity * 100).toFixed(0)}% match`
                          : `#${source.chunkIndex}`}
                      </span>
                    </div>
                    <p className="text-muted line-clamp-3">{source.content}</p>
                    {source.sourceUrl && (
                      <a
                        href={safeUrl(source.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-accent hover:underline mt-1 inline-block"
                      >
                        {source.sourceName}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}