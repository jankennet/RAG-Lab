import { RagDocument } from "@/lib/types";

interface ChatMessageProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    sources?: RagDocument[];
  };
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  return (
    <div className={`flex w-full mb-4 ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${isUser ? "bg-accent/20" : "bg-bg/50"} rounded-xl px-4 py-2 max-w-[80%] ${isUser ? "text-right" : "text-left"}`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <h3 className="font-semibold text-sm text-muted mb-1">Sources:</h3>
            <div className="space-y-1 text-xs">
              {message.sources.map((source, index) => (
                <div key={source.id} className="flex items-start">
                  <div className="flex-shrink-0">
                    <span className="text-muted">{index + 1}.</span>
                  </div>
                  <div className="ml-2 flex-1">
                    <div className="font-medium">{source.title}</div>
                    <div className="text-muted">{source.sourceName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}