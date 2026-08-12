// One trend card on the compare page: the latest run for a dataset/model
// group, its Token F1 + Latency tiles with delta vs the prior run, the two
// sparklines (F1 accent, latency accent-strong), and the "Open latest run"
// link. Lifted verbatim from compare/page.tsx L148-194 — all derived values
// (latest, previous, deltas, f1/latency value arrays) computed inside the
// card from its `group`, so the page maps groups into cards without threading
// per-group math. Uses the Phase-1 trend lib (formatDelta/metricValue/
// sparkline/metricSummary) + lib/format formatMs — no inline formatters.

"use client";

import Link from "next/link";
import type { TrendGroup } from "@/app/(dashboard)/lib/benchmark-trends";
import {
  formatDelta,
  metricValue,
  sparkline,
  metricSummary,
} from "@/app/(dashboard)/lib/benchmark-trends";
import { formatMs } from "@/app/(dashboard)/lib/format";

type TrendCardProps = {
  group: TrendGroup;
};

export default function TrendCard({ group }: TrendCardProps) {
  const latest = group.runs[group.runs.length - 1];
  const previous = group.runs[group.runs.length - 2];
  const tokenF1Delta = previous ? latest.metrics.tokenF1 - previous.metrics.tokenF1 : 0;
  const latencyDelta = previous ? latest.metrics.latencyMs - previous.metrics.latencyMs : 0;
  const f1Values = group.runs.map((run) => metricValue(run, "tokenF1"));
  const latencyValues = group.runs.map((run) => metricValue(run, "latencyMs"));

  return (
    <article className="bg-bg-alt border border-line rounded-2xl p-5 space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-muted uppercase tracking-wider">{group.datasetName}</p>
        <h2 className="font-semibold text-text">
          {group.provider}/{group.model}
        </h2>
        <p className="text-xs text-muted">Latest run {new Date(latest.createdAt).toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-line bg-bg/50 p-3">
          <p className="text-xs text-muted mb-1">Token F1</p>
          <p className="font-mono text-base text-text">{(latest.metrics.tokenF1 * 100).toFixed(1)}%</p>
          <p className={`text-xs mt-1 ${tokenF1Delta >= 0 ? "text-success" : "text-danger"}`}>
            {previous ? formatDelta(tokenF1Delta) : "No prior run"}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-bg/50 p-3">
          <p className="text-xs text-muted mb-1">Latency</p>
          <p className="font-mono text-base text-text">{formatMs(latest.metrics.latencyMs)}</p>
          <p className={`text-xs mt-1 ${latencyDelta <= 0 ? "text-success" : "text-danger"}`}>
            {previous ? formatDelta(latencyDelta, true) : "No prior run"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Token F1 trend</span>
            <span>{metricSummary(latest)}</span>
          </div>
          <svg viewBox="0 0 100 36" className="w-full h-10 overflow-visible">
            <polyline
              points={sparkline(f1Values)}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-accent"
            />
          </svg>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Latency trend</span>
            <span>{group.runs.length} runs</span>
          </div>
          <svg viewBox="0 0 100 36" className="w-full h-10 overflow-visible">
            <polyline
              points={sparkline(latencyValues)}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-accent-strong"
            />
          </svg>
        </div>
      </div>

      <Link href={`/benchmarks/${latest.id}`} className="text-xs text-accent hover:underline inline-block">
        Open latest run →
      </Link>
    </article>
  );
}
