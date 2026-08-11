// Latency badge for benchmark detail/history. Lifted verbatim from
// app/(dashboard)/benchmarks/[id]/page.tsx (L79-91). The 500ms / 2000ms
// thresholds are the latency analog of ScoreBadge's 0.7 / 0.4 score bands.

import { formatMs } from "@/app/(dashboard)/lib/format";

type LatencyBadgeProps = {
  ms: number;
  size?: "sm" | "lg";
};

export default function LatencyBadge({ ms, size = "sm" }: LatencyBadgeProps) {
  const dim = size === "lg" ? "text-lg px-3 py-1" : "text-xs px-2 py-0.5";
  const color =
    ms < 500
      ? "text-success bg-success/10 border-success/20"
      : ms < 2000
        ? "text-warning bg-warning/10 border-warning/20"
        : "text-danger bg-danger/10 border-danger/20";
  return (
    <span className={`font-mono font-medium rounded-full border ${color} ${dim}`}>
      {formatMs(ms)}
    </span>
  );
}
