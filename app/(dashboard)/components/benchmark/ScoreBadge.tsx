// Unified score badge. Previously there were three copies:
//   - text-only (benchmarks/page.tsx): a colored span, no pill.
//   - sized badge (benchmarks/[id]/page.tsx): bordered pill, sm|lg.
//   - scoreClass helper (benchmarks/[id]/page.tsx): color-only, for bars.
// One component + `variant` prop covers all three. The 0.7 / 0.4 thresholds
// (and the latency 500/2000 thresholds in LatencyBadge) live here as the single
// source of truth.

type ScoreBadgeProps = {
  score: number;
  size?: "sm" | "lg";
  /** "badge" = bordered pill (detail page). "text" = colored inline span (history list). */
  variant?: "badge" | "text";
};

const TEXT_COLOR = (score: number): string =>
  score >= 0.7 ? "text-success" : score >= 0.4 ? "text-warning" : "text-danger";

const BADGE_COLOR = (score: number): string =>
  score >= 0.7
    ? "text-success bg-success/10 border-success/20"
    : score >= 0.4
      ? "text-warning bg-warning/10 border-warning/20"
      : "text-danger bg-danger/10 border-danger/20";

/** Color-only class for progress bars, mirroring the badge thresholds. */
export function scoreColorClass(score: number): string {
  return TEXT_COLOR(score);
}

export default function ScoreBadge({ score, size = "sm", variant = "badge" }: ScoreBadgeProps) {
  const pct = (score * 100).toFixed(1);
  const color = variant === "text" ? TEXT_COLOR(score) : BADGE_COLOR(score);
  const dim = size === "lg" ? "text-lg px-3 py-1" : "text-xs px-2 py-0.5";

  if (variant === "text") {
    return <span className={`font-mono text-xs font-medium ${color}`}>{pct}%</span>;
  }
  return (
    <span className={`font-mono font-medium rounded-full border ${color} ${dim}`}>
      {pct}%
    </span>
  );
}
