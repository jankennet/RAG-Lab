// Fetch the model list for a provider from /api/models. Lifted verbatim from
// the effect in components/ModelSelector.tsx (L33-77) and the inline copy in
// settings/page.tsx (L65-110). Hooks instead of duplicating the fetch+cancel
// boilerplate in both. Returns curated-empty when the provider isn't fetchable.

"use client";

import { useEffect, useState } from "react";
import { PROVIDERS, type LlmProvider } from "@/shared/types";

interface ModelsApiResponse {
  provider: string;
  models: string[];
  fetched: boolean;
  defaultModel: string;
}

export type ProviderModelsState = {
  /** Live-fetched or curated-fallback model ids for the provider. Empty until resolved. */
  dynamicModels: string[];
  isFetching: boolean;
  /** True only when the API actually called the provider (not a curated fallback). */
  fetchedLive: boolean;
};

export function useProviderModels(provider: LlmProvider): ProviderModelsState {
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedLive, setFetchedLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      setIsFetching(true);
      setFetchedLive(false);
      try {
        const response = await fetch(`/api/models?provider=${encodeURIComponent(provider)}`);
        if (!response.ok) return;
        const data = (await response.json()) as ModelsApiResponse;
        if (!cancelled) {
          setDynamicModels(data.models ?? []);
          if (data.fetched) setFetchedLive(true);
        }
      } catch {
        // Fail silently — server returns curated fallback
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }

    const pConfig = PROVIDERS.find((p) => p.value === provider);
    if (pConfig?.fetchable) {
      fetchModels();
    } else {
      setDynamicModels([]);
      setIsFetching(false);
    }

    return () => {
      cancelled = true;
    };
  }, [provider]);

  return { dynamicModels, isFetching, fetchedLive };
}

/** Build the model <option> list: live API preferred, curated fallback included,
 *  current selection always present. Lifted from ModelSelector + settings. */
export function buildModelOptions(
  dynamicModels: string[],
  curated: string[],
  currentModel: string,
): string[] {
  const list = dynamicModels.length > 0 ? [...dynamicModels] : [...curated];
  if (currentModel && !list.includes(currentModel)) list.push(currentModel);
  return list.sort();
}
