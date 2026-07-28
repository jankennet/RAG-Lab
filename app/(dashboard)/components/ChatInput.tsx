"use client";

import { useRef, useEffect, useCallback } from "react";

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  value,
  onChange,
  onKeyDown,
  disabled = false,
  placeholder = "Ask a question...",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    resize();
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      className="w-full resize-none rounded-2xl bg-panel border border-line px-4 py-3 text-sm text-text placeholder:text-muted/50 outline-none transition-all duration-200 focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(142,242,208,0.08)] disabled:opacity-50"
      style={{ maxHeight: "200px" }}
    />
  );
}