// Answer-status breakdown chip row on the detail header: answered / no answer
// (refused) / empty / errors counts, plus the "All unanswered" diagnostic line
// when every answer was empty + no errors (the classic missing-API-key case).
// Lifted verbatim from benchmarks/[id]/page.tsx L229-250. The `errorCount`
// chip is conditional (only when non-zero, `!!run.errorCount`) — preserved.

import type { BenchmarkRun } from "@/client/opfs";

type AnswerStatusBreakdownProps = {
  run: Pick<BenchmarkRun, "answeredCount" | "refusedCount" | "emptyCount" | "errorCount" | "totalQuestions" | "provider">;
};

export default function AnswerStatusBreakdown({ run }: AnswerStatusBreakdownProps) {
  return (
    <>
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
    </>
  );
}
