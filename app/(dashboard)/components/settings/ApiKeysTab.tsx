// Settings → API Keys tab. Lifted verbatim from settings/page.tsx L375-463:
// the three provider key forms (nvidia / openai / anthropic) with the validated
// / configured / enter-key status badge, the password-manager username hint
// input, the password field, and the disabled-while-submitting Save button.
//
// SRP change: the password input uses the shared `TextField` (the class was
// INPUT_FULL_CLASS + "mb-2"); everything else copied byte-identical.
// `PROVIDER_LABELS` now imported from lib/provider-labels (was inline).

"use client";

import { useState } from "react";
import type { LlmProvider } from "@/shared/types";
import { PROVIDER_LABELS } from "@/app/(dashboard)/lib/provider-labels";
import TextField from "@/app/(dashboard)/components/ui/TextField";
import type { ApiKeyStatus } from "@/app/(dashboard)/components/DashboardProvider";

type ApiKeysTabProps = {
  submitApiKey: (provider: LlmProvider, key: string) => Promise<boolean>;
  apiKeyStatus: ApiKeyStatus;
};

export default function ApiKeysTab({ submitApiKey, apiKeyStatus }: ApiKeysTabProps) {
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [localKeys, setLocalKeys] = useState<Record<string, string>>({});

  const handleSubmitKey = async (provider: LlmProvider) => {
    const key = localKeys[provider];
    if (!key) return;

    setSubmitting((prev) => ({ ...prev, [provider]: true }));
    await submitApiKey(provider, key);
    setSubmitting((prev) => ({ ...prev, [provider]: false }));
  };

  return (
    <div className="bg-bg-alt rounded-2xl border border-line p-6">
      <h2 className="font-semibold mb-2">API Keys</h2>
      <p className="text-sm text-muted mb-6">
        Keys are encrypted and stored server-side in httpOnly cookies. Never logged or exposed to client JavaScript.
      </p>

      <div className="space-y-6">
        {(["nvidia", "openai", "anthropic"] as LlmProvider[]).map((provider) => {
          const status = apiKeyStatus[provider];
          const isKeyValidated = status?.validated ?? false;
          const isKeySet = apiKeyStatus[provider]?.hasKey ?? false;
          const isSubmitting = submitting[provider] ?? false;

          return (
            <form
              key={provider}
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitKey(provider);
              }}
              className="border-b border-line/50 last:border-b-0 pb-5 last:pb-0"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{PROVIDER_LABELS[provider]}</span>

                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    isKeyValidated
                      ? "bg-success/20 text-success"
                      : isKeySet
                        ? "bg-accent/20 text-accent"
                        : "bg-danger/20 text-danger"
                  }`}
                >
                  {isKeyValidated
                    ? "Valid"
                    : isKeySet
                      ? "Key Configured"
                      : "Enter key for this session"}
                </span>
              </div>

              {/* Hidden username for password managers */}
              <input
                type="text"
                name="username"
                value={provider}
                autoComplete="username"
                readOnly
                hidden
              />

              <TextField
                id={`${provider}-password`}
                name="password"
                type="password"
                value={localKeys[provider] ?? ""}
                onChange={(e) =>
                  setLocalKeys((prev) => ({
                    ...prev,
                    [provider]: e.target.value,
                  }))
                }
                className="mb-2"
                placeholder={
                  isKeySet
                    ? "Key Configured — enter a new key"
                    : `Enter your ${PROVIDER_LABELS[provider]} API key`
                }
                autoComplete="current-password"
              />

              <button
                type="submit"
                disabled={!localKeys[provider] || isSubmitting}
                className="w-full px-3 py-2 bg-accent/10 border border-accent/20 text-accent text-sm font-medium rounded-xl hover:bg-accent/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Testing & saving..." : "Save & Validate"}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
