"use client";

import { useState } from "react";

type ChatInputProps = {
  value: string;
  sending?: boolean;
  onChange: (value: string) => void;
  onSend: (value: string) => void | Promise<void>;
};

const quickActions = ["Summarize source set", "Find conflicts", "Draft answer", "Show citations"];

export function ChatInput({ value, sending, onChange, onSend }: ChatInputProps) {
  const [localValue, setLocalValue] = useState(value);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSend(localValue || value);
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-toolbar">
        {quickActions.map((action) => (
          <button key={action} className="composer-chip" type="button" onClick={() => setLocalValue(action)}>
            {action}
          </button>
        ))}
      </div>

      <textarea
        className="composer-input"
        value={localValue}
        onChange={(event) => {
          setLocalValue(event.target.value);
          onChange(event.target.value);
        }}
        placeholder="Ask about dataset, sources, or how to shape pipeline."
      />

      <div className="composer-footer">
        <span>Shift+Enter new line. Enter send.</span>
        <button className="primary-button" type="submit" disabled={sending}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
