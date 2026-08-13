// Settings → Data tab ("Delete All Data"). Lifted verbatim from
// settings/page.tsx L466-537: the danger-bordered card, DELETE-typing guard,
// scope-checkbox grid (≥1 required), and the Delete-Selected button with its
// three label states. On success it shows the green reset banner and restores
// DEFAULT_NUKE_SCOPE + clears the confirm field — same as the original.
//
// R3 (DashboardProvider is a leaf): this tab only *calls* `nukeEverything` with
// the selected scope. The teardown logic itself stays in DashboardProvider —
// not lifted, not duplicated, not modified here.
//
// The DELETE-confirm input keeps a raw `focus:border-danger/40` (diverges from
// TextField's accent focus) so it stays unbundled. `NUKE_SCOPE_LABELS` +
// `DEFAULT_NUKE_SCOPE` come from lib/settings/settings.constants (typo
// NIKE→NUKE fixed there).

"use client";

import { useState } from "react";
import type { NukeOptions } from "@/app/(dashboard)/components/DashboardProvider";
import { DEFAULT_NUKE_SCOPE, NUKE_SCOPE_LABELS } from "@/app/(dashboard)/lib/settings/settings.constants";

type DataNukeTabProps = {
  nukeEverything: (options?: NukeOptions) => Promise<void>;
};

export default function DataNukeTab({ nukeEverything }: DataNukeTabProps) {
  const [nukeConfirm, setNukeConfirm] = useState("");
  const [nuking, setNuking] = useState(false);
  const [nukeDone, setNukeDone] = useState(false);
  const [nukeScope, setNukeScope] = useState<Required<NukeOptions>>(DEFAULT_NUKE_SCOPE);

  const anyScopeSelected = Object.values(nukeScope).some(Boolean);

  return (
    <div className="bg-bg-alt rounded-2xl border border-danger/30 p-6">
      <h2 className="font-semibold mb-2 text-danger">Delete All Data</h2>
      <p className="text-sm text-muted mb-6">
        This permanently deletes all datasets, API keys, preferences, and session data from this browser. Only affects this webapp. Data cannot be recovered.
      </p>

      {nukeDone ? (
        <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success">
          All data deleted. App reset to defaults.
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">
              Type <code className="text-danger bg-danger/10 px-1.5 py-0.5 rounded">DELETE</code> to confirm
            </label>
            <input
              type="text"
              value={nukeConfirm}
              onChange={(e) => setNukeConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-danger/40 transition-colors"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Select what to delete</label>
            <div className="grid grid-cols-2 gap-2">
              {NUKE_SCOPE_LABELS.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#03111a] border border-line cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={nukeScope[key]}
                    onChange={(e) =>
                      setNukeScope((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="accent-danger"
                  />
                  {label}
                </label>
              ))}
            </div>
            {!anyScopeSelected && (
              <p className="text-xs text-danger mt-2">Select at least one item to delete.</p>
            )}
          </div>
          <button
            onClick={async () => {
              if (nukeConfirm !== "DELETE" || !anyScopeSelected) return;
              setNuking(true);
              await nukeEverything(nukeScope);
              setNuking(false);
              setNukeDone(true);
              setNukeConfirm("");
              setNukeScope(DEFAULT_NUKE_SCOPE);
            }}
            disabled={nukeConfirm !== "DELETE" || nuking || !anyScopeSelected}
            className="w-full px-4 py-2.5 bg-danger text-white font-semibold rounded-xl hover:bg-danger/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {nuking ? "Deleting..." : nukeConfirm === "DELETE" ? "Delete Selected" : "Delete Selected (type DELETE above)"}
          </button>
        </div>
      )}
    </div>
  );
}
