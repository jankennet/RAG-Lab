"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { loadBenchmarkRun } from "@/client/opfs";
import type { CompactQuestionResult, BenchmarkRun, BenchmarkMetrics } from "@/client/opfs";
import { PageDetailSkeleton } from "../../components/Skeleton";

type MetricDef = {
  key: keyof BenchmarkMetrics;
  label: string;
  question: string;
  definition: string;
  suffix: string;
  isLatency: boolean;
};

const METRICS: MetricDef[] = [
  {
    key: "tokenF1",
    label: "Token F1",
    question: "How accurate is the answer?",
    definition: "Token-overlap F1 between generated answer and reference document content.",
    suffix: "higher is better",
    isLatency: false,
  },
  {
    key: "latencyMs",
    label: "Latency",
    question: "How fast is the retrieval?",
    definition: "Average time per question to search + evaluate + generate answer.",
    suffix: "lower is better",
    isLatency: true,
  },
  {
    key: "faithfulness",
    label: "Faithfulness",
    question: "Is the context factually correct?",
    definition: "Does the retrieved context contain factually consistent information?",
    suffix: "higher is better",
    isLatency: false,
  },
  {
    key: "answerRelevance",
    label: "Answer Relevance",
    question: "Does the context address the question?",
    definition: "Does the generated answer actually address the question asked?",
    suffix: "higher is better",
    isLatency: false,
  },
  {
    key: "exactMatch",
    label: "Exact Match",
    question: "Does the answer match the ground truth?",
    definition: "Normalized exact-match against the reference answer.",
    suffix: "higher is better",
    isLatency: false,
  },
];

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const pct = (score * 100).toFixed(1);
  const color =
    score >= 0.7 ? "text-success bg-success/10 border-success/20" :
    score >= 0.4 ? "text-warning bg-warning/10 border-warning/20" :
    "text-danger bg-danger/10 border-danger/20";
  const dim = size === "lg" ? "text-lg px-3 py-1" : "text-xs px-2 py-0.5";
  return (
    <span className={`font-mono font-medium rounded-full border ${color} ${dim}`}>
      {pct}%
    </span>
  );
}

function LatencyBadge({ ms, size = "sm" }: { ms: number; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "text-lg px-3 py-1" : "text-xs px-2 py-0.5";
  const color = ms < 500
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

function DetailRow({ q, idx }: { q: CompactQuestionResult; idx: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-alt/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-muted font-mono shrink-0">Q{idx + 1}</span>
          {q.answerStatus && q.answerStatus !== "answered" && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-warning bg-warning/10 border border-warning/30 rounded-full px-2 py-0.5 shrink-0">
              {q.answerStatus === "refused" ? "no answer" : "empty"}
            </span>
          )}
          <p className="text-sm truncate leading-snug">{q.question || "(empty question)"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreBadge score={q.tokenF1} />
          <LatencyBadge ms={q.latencyMs} />
          <span className="text-muted text-xs ml-1">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-line space-y-3 text-sm">
          {q.answerStatus && q.answerStatus !== "answered" && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 text-xs text-warning">
              {q.answerStatus === "refused"
                ? "Skipped: no answer produced (refused / “not enough context”). Relevance scored 0."
                : q.generationError
                ? `Skipped: ${q.generationError}`
                : "Skipped: empty answer. Quality scored 0."}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Token F1</span>
              <ScoreBadge score={q.tokenF1} />
            </div>
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Latency</span>
              <LatencyBadge ms={q.latencyMs} />
            </div>
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Faithfulness</span>
              <ScoreBadge score={q.faithfulness} />
            </div>
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Answer Relevance</span>
              <ScoreBadge score={q.answerRelevance} />
            </div>
          </div>

          <div className="bg-bg-alt rounded-lg px-3 py-2">
            <span className="text-xs text-muted block mb-1">Ground Truth</span>
            <p className="text-xs text-text leading-relaxed">{q.groundTruth || "(none)"}</p>
          </div>
          <div className="bg-bg-alt rounded-lg px-3 py-2">
            <span className="text-xs text-muted block mb-1">Generated Answer</span>
            <p className="text-xs text-text leading-relaxed">{q.generatedAnswer || "(none)"}</p>
          </div>

          <div>
            <span className="text-xs text-muted block mb-1">
              Retrieved Docs (top-{q.retrievalCount})
            </span>
            <ul className="space-y-1">
              {q.retrievedDocTitles.map((t, i) => (
                <li key={i} className="text-xs text-text bg-bg-alt rounded-lg px-3 py-1.5 truncate">
                  #{i + 1}: {t || "(untitled)"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BenchmarkDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [run, setRun] = useState<BenchmarkRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadBenchmarkRun(id)
      .then((data) => {
        if (!data) throw new Error("Benchmark not found");
        setRun(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading && !run) {
    return (
      <PageDetailSkeleton />
    );
  }

  if (error || !run) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
            <p className="text-danger text-sm">{error || "Run not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const scoreClass = (v: number) =>
    v >= 0.7 ? "text-success" : v >= 0.4 ? "text-warning" : "text-danger";

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">{run.datasetName}</h1>
          <p className="text-sm text-muted">
            {new Date(run.createdAt).toLocaleString()} &middot; {run.totalQuestions} questions
          </p>
          <p className="text-xs text-muted mt-1 font-mono">
            {run.provider}/{run.model}
          </p>

          {/* Answer-status breakdown — why the scores are what they are */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-success bg-success/10 border border-success/20 rounded-full px-2 py-0.5">
              answered {run.answeredCount ?? 0}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-warning bg-warning/10 border border-warning/30 rounded-full px-2 py-0.5">
              no answer {run.refusedCount ?? 0}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-danger bg-danger/10 border border-danger/30 rounded-full px-2 py-0.5">
              empty {run.emptyCount ?? 0}
            </span>
            {!!run.errorCount && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-danger bg-danger/10 border border-danger/30 rounded-full px-2 py-0.5">
                errors {run.errorCount}
              </span>
            )}
          </div>
          {!!run.emptyCount && !run.errorCount && run.emptyCount === run.totalQuestions && (
            <p className="text-xs text-danger mt-2">
              All unanswered. The generation API was never called — most likely no API key for
              provider "{run.provider}". Add it in Settings (stored server-side).
            </p>
          )}
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
          {METRICS.map((m) => {
            const val = run.metrics[m.key] ?? 0;
            return (
              <div key={m.key} className="bg-bg-alt rounded-2xl border border-line p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{m.label}</h3>
                    <p className="text-xs text-muted mt-0.5 italic">{m.question}</p>
                  </div>
                  {m.isLatency ? (
                    <LatencyBadge ms={val} size="lg" />
                  ) : (
                    <ScoreBadge score={val} size="lg" />
                  )}
                </div>
                <p className="text-xs text-muted">{m.definition}</p>
                {!m.isLatency && (
                  <div className="mt-3 h-2 bg-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${scoreClass(val)}`}
                      style={{ width: `${val * 100}%`, background: "currentColor" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Per-question breakdown */}
        <h2 className="font-semibold mb-3">Per-Question Breakdown ({run.details.length})</h2>
        <div className="space-y-2">
          {run.details.map((q, i) => (
            <DetailRow key={i} q={q} idx={i} />
          ))}
        </div>
      </div>
    </div>
  );
}