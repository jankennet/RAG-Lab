// Shared display formatters. React-free — safe to import from any lib/hook/component.
// Consolidates the `formatMs` copies that previously lived inline in compare, the
// benchmarks pages, (the deleted) ranking, and about's `formatCount`.

/** Format a latency in ms as "412ms" or "2.3s". */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Format a 0–1 score as a percentage with one decimal, e.g. 0.823 → "82.3%". */
export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Pluralize a count + noun: 1 dataset, 2 datasets. */
export function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}
