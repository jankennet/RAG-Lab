// Compare-page leaderboard: latest completed run per dataset/model group,
// one row each, seven columns (Model, Dataset, Token F1, Faithfulness,
// Relevance, Ctx util, Latency). Lifted verbatim from compare/page.tsx
// L198-234. The `exactMatch ?? 0` coalescence on the Ctx-util column is
// preserved verbatim — it is NOT a column-name/field match (the column header
// says "Ctx util" but reads `exactMatch`; that mismatch is pre-existing and
// kept to avoid a display change). Rows are plain text cells — no per-row
// link (the page links out from the trend cards instead). Uses lib/format
// formatMs.

"use client";

import type { TrendGroup } from "@/app/(dashboard)/lib/benchmark-trends";
import { formatMs } from "@/app/(dashboard)/lib/format";

type BenchmarkLeaderboardTableProps = {
  groups: TrendGroup[];
};

export default function BenchmarkLeaderboardTable({ groups }: BenchmarkLeaderboardTableProps) {
  return (
    <section className="bg-bg-alt border border-line rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-line">
        <h2 className="font-semibold">Leaderboard</h2>
        <p className="text-sm text-muted mt-1">Latest completed run per dataset/model, sorted by best token F1.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line/60 bg-bg/50">
              <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Model</th>
              <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Dataset</th>
              <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Token F1</th>
              <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Faithfulness</th>
              <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Relevance</th>
              <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Ctx util</th>
              <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Latency</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const latest = group.runs[group.runs.length - 1];
              return (
                <tr
                  key={`${group.datasetName}-${group.provider}-${group.model}`}
                  className="border-b border-line/40 hover:bg-bg/40"
                >
                  <td className="py-3 px-4 font-mono text-accent">
                    {group.provider}/{group.model}
                  </td>
                  <td className="py-3 px-4 text-muted">{group.datasetName}</td>
                  <td className="py-3 px-4">{(latest.metrics.tokenF1 * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4">{(latest.metrics.faithfulness * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4">{(latest.metrics.answerRelevance * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4">{((latest.metrics.exactMatch ?? 0) * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4">{formatMs(latest.metrics.latencyMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
