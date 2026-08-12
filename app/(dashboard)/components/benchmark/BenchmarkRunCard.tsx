// One history row → links to the benchmark detail page. Lifted verbatim from
// benchmarks/page.tsx L496-545. The inline metrics strip uses the shared
// `ScoreBadge` text variant (the page's local ScoreBadge was text-only —
// variant="text" reproduces it exactly) and `formatMs` from lib/format.

import Link from "next/link";
import ScoreBadge from "./ScoreBadge";
import { formatMs } from "@/app/(dashboard)/lib/format";
import type { BenchmarkRun } from "@/client/opfs";

type BenchmarkRunCardProps = {
  run: BenchmarkRun;
};

export default function BenchmarkRunCard({ run }: BenchmarkRunCardProps) {
  return (
    <Link
      key={run.id}
      href={`/benchmarks/${run.id}`}
      className="block bg-bg-alt rounded-2xl border border-line p-5 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">{run.datasetName}</h3>
          <p className="text-xs text-muted mt-0.5">
            {new Date(run.createdAt).toLocaleString()}
          </p>
          <p className="text-xs text-muted mt-0.5 font-mono">
            {run.provider}/{run.model}
          </p>
        </div>
        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${
          run.status === "completed" ? "bg-success/10 border-success/20 text-success" :
          "bg-muted/10 border-muted/20 text-muted"
        }`}>
          {run.status}
        </span>
      </div>
      <div className="text-xs text-muted mb-3">{run.totalQuestions} questions</div>
      {run.metrics && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 border-t border-line">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted">Latency</span>
            <span className="font-mono text-xs font-medium">{formatMs(run.metrics.latencyMs)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted">Token F1</span>
            <ScoreBadge score={run.metrics.tokenF1} variant="text" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted">Faithfulness</span>
            <ScoreBadge score={run.metrics.faithfulness} variant="text" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted">Relevance</span>
            <ScoreBadge score={run.metrics.answerRelevance} variant="text" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted">Exact Match</span>
            <ScoreBadge score={run.metrics.exactMatch ?? 0} variant="text" />
          </div>
        </div>
      )}
    </Link>
  );
}
