// Single source of truth for the human-readable provider labels.
// Previously duplicated byte-identically in settings/page.tsx and
// components/ApiKeyMissingToast.tsx.

import type { LlmProvider } from "@/shared/types";

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  nvidia: "NVIDIA NIM",
  openai: "OpenAI",
  anthropic: "Anthropic",
};
