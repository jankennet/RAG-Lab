// One question card in the benchmark-datasets detail list. Lifted verbatim
// from benchmark-datasets/[id]/page.tsx L140-168: the Q{n} header row with the
// category chip (whitespace-nowrap, shrink-0 so the chip never wraps the
// question), the ground-truth block on a subtle alternate bg, and the
// optional difficulty row. `idx` is 0-based; the page rendered `Q{i + 1}.`
// — preserved. Cards have a per-card overflow-hidden + inner border-line/50
// divider; kept as-is.

"use client";

import type { BenchmarkQuestion } from "@/client/benchmark-questions";

type QuestionRowProps = {
  q: BenchmarkQuestion;
  idx: number;
};

export default function QuestionRow({ q, idx }: QuestionRowProps) {
  return (
    <div className="bg-bg-alt border border-line rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-line/50">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-text leading-relaxed">
            <span className="text-muted font-mono mr-2">Q{idx + 1}.</span>
            {q.question}
          </p>
          {q.category && (
            <span className="text-xs text-muted bg-bg px-2 py-0.5 rounded-full border border-line whitespace-nowrap shrink-0">
              {q.category}
            </span>
          )}
        </div>
      </div>
      <div className="px-4 py-3 bg-bg/40">
        <span className="text-xs text-muted block mb-1">Ground Truth:</span>
        <p className="text-sm text-text leading-relaxed">{q.groundTruth}</p>
      </div>
      {q.difficulty && (
        <div className="px-4 py-2 border-t border-line/30 flex items-center gap-2">
          <span className="text-xs text-muted">Difficulty:</span>
          <span className="text-xs font-medium text-text">{q.difficulty}</span>
        </div>
      )}
    </div>
  );
}
