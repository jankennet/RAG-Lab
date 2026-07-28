import { ApiKeyEntry } from "@/shared/types";

interface ApiKeyCardProps {
  provider: keyof Omit<ApiKeyEntry, "validated" | "model">;
  keyInfo: ApiKeyEntry;
}

export default function ApiKeyCard({ provider, keyInfo }: ApiKeyCardProps) {
  const providerLabels: Record<string, string> = {
    nvidia: "NVIDIA NIM",
    openai: "OpenAI",
    anthropic: "Anthropic",
  };

  const providerColors: Record<string, string> = {
    nvidia: "bg-blue-500/20 text-blue-400",
    openai: "bg-green-500/20 text-green-400",
    anthropic: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-text">{providerLabels[provider] || provider}</h3>
        <div className="flex items-center space-x-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${keyInfo.validated ? "bg-green-500" : "bg-red-500"}`}
          ></div>
          <span className="text-xs">{keyInfo.validated ? "Connected" : "Disconnected"}</span>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Status</span>
          <span className="font-medium">
            {keyInfo.validated ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Model</span>
          <span className="font-medium">{keyInfo.model || "Not set"}</span>
        </div>
      </div>
      <button
        onClick={() => {
          // In a real app, this would open a modal to update the API key
          alert("API key management not implemented yet");
        }}
        className="w-full mt-4 px-3 py-1.5 text-xs font-medium bg-accent/20 hover:bg-accent/30 rounded-lg transition-colors"
      >
        Manage API Key
      </button>
    </div>
  );
}
