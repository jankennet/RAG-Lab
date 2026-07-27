"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiKeyCard } from "../components/ApiKeyCard";
import { ModelSelector } from "../components/ModelSelector";
import { dashboardProviders } from "@/lib/dashboard-data";
import {
  defaultDashboardPreferences,
  loadDashboardPreferences,
  saveDashboardPreferences
} from "@/lib/dashboard-preferences";
import type { DashboardPreferences } from "@/lib/dashboard-preferences";

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultDashboardPreferences);

  useEffect(() => {
    setPreferences(loadDashboardPreferences());
  }, []);

  const activeProvider = useMemo(
    () => dashboardProviders.find((provider) => provider.value === preferences.provider) ?? dashboardProviders[0],
    [preferences.provider]
  );

  function updatePreferences(nextPreferences: DashboardPreferences) {
    setPreferences(nextPreferences);
    saveDashboardPreferences(nextPreferences);
  }

  return (
    <section className="page-stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="page-title">Keys and model control.</h1>
          <p className="page-lede">User-managed provider keys, provider pick, and Supabase connection live here.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="panel-surface stack-panel">
          <ModelSelector
            provider={preferences.provider}
            model={preferences.model}
            providers={dashboardProviders}
            onChange={(provider, model) => updatePreferences({ ...preferences, provider, model })}
          />
        </div>

        <div className="panel-surface stack-panel">
          <h2>Keys</h2>
          <p className="muted-copy">Keep keys local in browser storage until backend auth lands.</p>
          <ApiKeyCard
            label="NVIDIA NIM"
            description="Used for chat and embedding endpoints."
            value={preferences.apiKeys.nvidia?.key ?? ""}
            onChange={(key) => updatePreferences({ ...preferences, apiKeys: { ...preferences.apiKeys, nvidia: { key, validated: Boolean(key) } } })}
          />
          <ApiKeyCard
            label="OpenAI"
            description="For alternate models and evaluation flows."
            value={preferences.apiKeys.openai?.key ?? ""}
            onChange={(key) => updatePreferences({ ...preferences, apiKeys: { ...preferences.apiKeys, openai: { key, validated: Boolean(key) } } })}
          />
          <ApiKeyCard
            label="Anthropic"
            description="For Claude-style chat and future fallback path."
            value={preferences.apiKeys.anthropic?.key ?? ""}
            onChange={(key) => updatePreferences({ ...preferences, apiKeys: { ...preferences.apiKeys, anthropic: { key, validated: Boolean(key) } } })}
          />
        </div>

        <div className="panel-surface stack-panel">
          <h2>Storage</h2>
          <ApiKeyCard
            label="Supabase URL"
            description="Vector DB endpoint and auth domain."
            value={preferences.apiKeys.supabaseUrl ?? ""}
            onChange={(value) => updatePreferences({ ...preferences, apiKeys: { ...preferences.apiKeys, supabaseUrl: value } })}
          />
          <ApiKeyCard
            label="Supabase key"
            description="Service role or auth key, depending on deployment.",
            value={preferences.apiKeys.supabaseKey ?? ""}
            onChange={(value) => updatePreferences({ ...preferences, apiKeys: { ...preferences.apiKeys, supabaseKey: value } })}
          />

          <div className="status-list compact">
            <div><span>Active provider</span><strong>{activeProvider.label}</strong></div>
            <div><span>Default model</span><strong>{activeProvider.defaultModel}</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}
