// One metric card on the benchmark detail page: label, italic question, the
// score/latency badge (lg), definition, and the colored percentage bar for
// non-latency metrics. Lifted verbatim from benchmarks/[id]/page.tsx L257-281.
// The bar uses `scoreColorClass` (shared ScoreBadge export) — the page's local
// `scoreClass` helper is absorbed here, per the Phase 2 ScoreBadge decision.
// `MetricDef` comes from the shared lib so the page's METRICS table is gone.

import type { MetricDef } from "@/app/(dashboard)/lib/benchmark-metrics";
import type { BenchmarkMetrics } from "@/client/opfs";
import ScoreBadge, { scoreColorClass } from "./ScoreBadge";
import LatencyBadge from "./LatencyBadge";

type MetricCardProps = {
  metric: MetricDef;
  value: number;
};

export default function MetricCard({ metric, value }: MetricCardProps) {
  return (
    <div className="bg-bg-alt rounded-2xl border border-line p-6">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-sm">{metric.label}</h3>
          <p className="text-xs text-muted mt-0.5 italic">{metric.question}</p>
        </div>
        {metric.isLatency ? (
          <LatencyBadge ms={value} size="lg" />
        ) : (
          <ScoreBadge score={value} size="lg" />
        )}
      </div>
      <p className="text-xs text-muted">{metric.definition}</p>
      {!metric.isLatency && (
        <div className="mt-3 h-2 bg-bg rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreColorClass(value)}`}
            style={{ width: `${value * 100}%`, background: "currentColor" }}
          />
        </div>
      )}
    </div>
  );
}
