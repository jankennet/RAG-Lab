import { useCallback } from "react";
import type { LlmProvider } from "@/shared/types";

interface InferenceControlsProps {
  showInference: boolean;
  onToggleInference: () => void;
  preferences: {
    topK: number | null;
    temperature: number | null;
    topP: number | null;
    maxTokens: number | null;
  };
  setTopK: (value: number) => void;
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
  setMaxTokens: (value: number) => void;
}

export default function InferenceControls({
  showInference,
  onToggleInference,
  preferences,
  setTopK,
  setTemperature,
  setTopP,
  setMaxTokens,
}: InferenceControlsProps) {
  if (!showInference) return null;

  return (
    <div className="px-6 py-3 border-b border-line flex-shrink-0 bg-bg-alt/50">
      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[10px] text-muted font-medium">
            Top K: {preferences.topK ?? 4}
          </span>
          <input
            type="range"
            min={1}
            max={200}
            step={1}
            value={preferences.topK ?? 4}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </label>
        <label className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[10px] text-muted font-medium">
            Temp: {(preferences.temperature ?? 0.2).toFixed(2)}
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={preferences.temperature ?? 0.2}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </label>
        <label className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[10px] text-muted font-medium">
            Top P: {(preferences.topP ?? 0.9).toFixed(2)}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={preferences.topP ?? 0.9}
            onChange={(e) => setTopP(Number(e.target.value))}
            className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </label>
        <label className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[10px] text-muted font-medium">
            Max Tokens: {preferences.maxTokens ?? 4096}
          </span>
          <input
            type="range"
            min={256}
            max={32768}
            step={256}
            value={preferences.maxTokens ?? 4096}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </label>
      </div>
    </div>
  );
}