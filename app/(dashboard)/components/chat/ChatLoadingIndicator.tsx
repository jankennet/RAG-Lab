interface ChatLoadingIndicatorProps {
  isLoading: boolean;
  loadingPhase: "idle" | "searching" | "generating";
}

export function ChatLoadingIndicator({ isLoading, loadingPhase }: ChatLoadingIndicatorProps) {
  if (!isLoading) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        {loadingPhase === "searching"
          ? "Searching relevant documents..."
          : "Generating answer..."}
      </div>
    </div>
  );
}