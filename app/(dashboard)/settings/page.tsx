"use client";

import { useState } from "react";
import { useDashboard } from "../components/DashboardProvider";
import { PageSettingsSkeleton } from "../components/Skeleton";
import PageShell from "@/app/(dashboard)/components/ui/PageShell";
import ModelsTab from "@/app/(dashboard)/components/settings/ModelsTab";
import ApiKeysTab from "@/app/(dashboard)/components/settings/ApiKeysTab";
import DataNukeTab from "@/app/(dashboard)/components/settings/DataNukeTab";

type SettingsTab = "models" | "apiKeys" | "data";

const TAB_LABELS: Record<SettingsTab, string> = {
  models: "Models",
  apiKeys: "API Keys",
  data: "Data",
};

export default function SettingsPage() {
  const {
    preferences,
    setProvider,
    setModel,
    setTopK,
    setTemperature,
    setTopP,
    setMaxTokens,
    submitApiKey,
    apiKeyStatus,
    nukeEverything,
    mounted,
  } = useDashboard();

  const [activeTab, setActiveTab] = useState<SettingsTab>("models");

  if (!mounted) {
    return <PageSettingsSkeleton />;
  }

  return (
    <PageShell maxWidth={2}>
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 bg-bg-alt rounded-xl w-fit">
        {(Object.keys(TAB_LABELS) as SettingsTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-accent text-[#03111a]"
                : "text-muted hover:text-text"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "models" && (
        <ModelsTab
          preferences={preferences}
          setProvider={setProvider}
          setModel={setModel}
          setTopK={setTopK}
          setTemperature={setTemperature}
          setTopP={setTopP}
          setMaxTokens={setMaxTokens}
        />
      )}

      {activeTab === "apiKeys" && (
        <ApiKeysTab submitApiKey={submitApiKey} apiKeyStatus={apiKeyStatus} />
      )}

      {activeTab === "data" && <DataNukeTab nukeEverything={nukeEverything} />}
    </PageShell>
  );
}
