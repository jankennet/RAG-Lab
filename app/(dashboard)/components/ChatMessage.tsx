import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { SourceCard } from "./SourceCard";

type ChatMessageProps = {
  message: ChatMessageType;
};

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <article className={`message message-${message.role}`}>
      <div className="message-meta">
        <span>{message.role === "user" ? "You" : "Assistant"}</span>
        <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      <div className="message-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {message.content}
        </ReactMarkdown>
      </div>

      {message.sources?.length ? (
        <div className="message-sources">
          {message.sources.map((source, index) => (
            <SourceCard key={`${source.id}-${source.chunkIndex}`} source={source} rank={index + 1} compact />
          ))}
        </div>
      ) : null}
    </article>
  );
}
