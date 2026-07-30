"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

type QuestionResult = {
  question: string;
  reference: string;
  retrievedCount: number;
  relevantInTopK: number;
  totalRelevant: number;
  recallAtK: number;
  precisionAtK: number;
  hitRateAtK: number;
  retrievedDocTitles: string[];
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
};

type BenchmarkMetrics = {
  recallAtK: number;
  precisionAtK: number;
  hitRateAtK: number;
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
};

type BenchmarkRun = {
  id: string;
  datasetName: string;
  totalQuestions: number;
  createdAt: number;
  metrics: BenchmarkMetrics;
  details: QuestionResult[];
};

type MetricDef = {
  key: keyof BenchmarkMetrics;
  label: string;
  question: string;
  definition: string;
  suffix: string;
};

const METRICS: MetricDef[] = [
  {
    key: "recallAtK",
    label: "Recall@k",
    question: "Did we find enough good documents?",
    definition: "Out of all relevant documents, what percentage did we retrieve in our top-k results?",
    suffix: "higher is better",
  },
  {
    key: "precisionAtK",
    label: "Precision@k",
    question: "Are most of our results good?",
    definition: "Out of the top-k documents we retrieved, what percentage are actually relevant?",
    suffix: "higher is better",
  },
  {
    key: "hitRateAtK",
    label: "Hit Rate@k",
    question: "Did we find at least one good document?",
    definition: "Percentage of queries where at least one relevant document appears in top-k results.",
    suffix: "higher is better",
  },
  {
    key: "faithfulness",
    label: "Faithfulness",
    question: "Is the answer factually correct?",
    definition: "Does the generated answer accurately reflect the information in the retrieved documents?",
    suffix: "higher is better",
  },
  {
    key: "answerRelevance",
    label: "Answer Relevance",
    question: "Does the answer address the question?",
    definition: "How well does the generated answer match the user’s question?",
    suffix: "higher is better",
  },
  {
    key: "contextUtilization",
    label: "Context Utilization",
    question: "How well did we use the retrieved information?",
    definition: "Measures how effectively the generation model used the retrieved context.",
    suffix: "higher is better",
  },
];

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

function DetailRow({ q, idx }: { q: QuestionResult; idx: number }) {
  const [open, setOpen] = useState(false);
  const avgGen = (q.faithfulness + q.answerRelevance + q.contextUtilization) / 3;
  const avgRet = (q.recallAtK + q.precisionAtK + q.hitRateAtK) / 3;

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-alt/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-muted font-mono shrink-0">Q{idx + 1}</span>
          <p className="text-sm truncate leading-snug">{q.question || "(empty question)"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreBadge score={avgRet} />
          <ScoreBadge score={avgGen} />
          <span className="text-muted text-xs ml-1">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-line space-y-3 text-sm">
          {/* Reference */}
          <div>
            <span className="text-xs text-muted block mb-1">Reference Answer</span>
            <p className="text-text bg-bg-alt rounded-lg px-3 py-2 text-xs leading-relaxed">
              {q.reference || "(none)"}
            </p>
          </div>

          {/* Metric scores per-question */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Recall@k</span>
              <ScoreBadge score={q.recallAtK} />
            </div>
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Precision@k</span>
              <ScoreBadge score={q.precisionAtK} />
            </div>
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Hit Rate@k</span>
              <ScoreBadge score={q.hitRateAtK} />
            </div>
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Faithfulness</span>
              <ScoreBadge score={q.faithfulness} />
            </div>
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Answer Relevance</span>
              <ScoreBadge score={q.answerRelevance} />
            </div>
            <div className="bg-bg-alt rounded-lg px-3 py-2">
              <span className="text-xs text-muted block">Context Util</span>
              <ScoreBadge score={q.contextUtilization} />
            </div>
          </div>

          {/* Retrieved docs */}
          <div>
            <span className="text-xs text-muted block mb-1">
              Retrieved Docs (top-{q.retrievedCount}, {q.relevantInTopK} relevant of {q.totalRelevant} total)
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
    fetch(`/api/benchmarks/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load benchmark");
        return r.json();
      })
      .then((data) => {
        setRun(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-muted text-center py-12">Loading benchmark detail...</p>
        </div>
      </div>
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
        </div>

        {/* Metric cards */}
        <div className="grid gap-4 mb-8">
          {METRICS.map((m) => {
            const val = run.metrics[m.key];
            return (
              <div key={m.key} className="bg-bg-alt rounded-2xl border border-line p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{m.label}</h3>
                    <p className="text-xs text-muted mt-0.5 italic">{m.question}</p>
                  </div>
                  <ScoreBadge score={val} size="lg" />
                </div>
                <p className="text-xs text-muted">{m.definition}</p>
                <div className="mt-3 h-2 bg-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${scoreClass(val)}`}
                    style={{ width: `${val * 100}%`, background: "currentColor" }}
                  />
                </div>
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