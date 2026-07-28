"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LlmProvider } from "@/shared/types";

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  nvidia: "NVIDIA NIM",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

type Props = {
  provider: LlmProvider;
  onDismiss: () => void;
};

export default function ApiKeyMissingToast({ provider, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in after mount
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    const cleanup = setTimeout(onDismiss, 5500);
    return () => {
      clearTimeout(timer);
      clearTimeout(cleanup);
    };
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0"
      }`}
    >
      <div className="flex items-center gap-4 px-5 py-3.5 bg-[#03111a] border border-warning/30 rounded-2xl shadow-lg shadow-black/30 max-w-md">
        <div>
          <p className="text-sm font-medium text-text">
            No API key configured for {PROVIDER_LABELS[provider]}
          </p>
          <p className="text-xs text-muted mt-0.5">
            Set your key in Settings to start chatting.
          </p>
        </div>
        <Link
          href="/settings"
          onClick={() => setVisible(false)}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-accent/10 border border-accent/20 text-accent rounded-xl hover:bg-accent/15 transition-colors"
        >
          Set Key
        </Link>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-muted hover:text-text transition-colors"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}