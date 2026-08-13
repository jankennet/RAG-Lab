// Settings-only constants — the "Delete All Data" tab's default scope and the
// scope checkbox labels. Previously inline in settings/page.tsx (L15-22 and
// L50-57, where the label array was misspelled `NIKE_SCOPE_LABELS`). Moved here
// and the typo fixed to `NUKE_SCOPE_LABELS` per the Phase 7 plan. The object
// shape is `Required<NukeOptions>` (all six keys present + boolean) so it can
// be fed straight to `nukeEverything` and toggled key-by-key in state.

import type { NukeOptions } from "@/app/(dashboard)/components/DashboardProvider";

/** All scopes selected by default — matches the pre-refactor page literal. */
export const DEFAULT_NUKE_SCOPE: Required<NukeOptions> = {
  apiKeys: true,
  datasets: true,
  questionSets: true,
  chats: true,
  benchmarks: true,
  preferences: true,
};

/** Checkbox row labels in display order. Keys are `keyof NukeOptions`. */
export const NUKE_SCOPE_LABELS: { key: keyof NukeOptions; label: string }[] = [
  { key: "apiKeys", label: "API Keys" },
  { key: "datasets", label: "Datasets" },
  { key: "questionSets", label: "Question sets" },
  { key: "chats", label: "Chats" },
  { key: "benchmarks", label: "Benchmark results" },
  { key: "preferences", label: "Preferences" },
];
