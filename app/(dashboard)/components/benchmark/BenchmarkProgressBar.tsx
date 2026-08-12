// Live NDJSON-driven progress bar shown while a benchmark run is in flight.
// Lifted verbatim from benchmarks/page.tsx L428-445 — the accent bar bound to
// `progress * 100`%, the "{done}/{limit} questions" pulse line, and the
// "2 LLM calls per question" footer. R2: the progress value is real
// (stream-pushed), not a timer — keep the transition-all duration-700 easing so
// the manual gate's visual parity holds.

type BenchmarkProgressBarProps = {
  progress: number;
  limit: number;
  provider: string;
  model: string;
};

export default function BenchmarkProgressBar({ progress, limit, provider, model }: BenchmarkProgressBarProps) {
  return (
    <div className="mt-6 bg-[#03111a] border border-accent/20 rounded-2xl p-5 overflow-hidden relative">
      <div className="h-2 bg-bg rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-3 min-h-[2.5rem]">
        <span className="text-accent font-mono text-sm animate-pulse">
          Benchmarking {Math.min(Math.round(progress * limit), limit)}/{limit} questions...
        </span>
      </div>
      <p className="text-xs text-muted mt-3 font-mono">
        {"> "}{provider}/{model} — this runs 2 LLM calls (generate + judge) per question
      </p>
    </div>
  );
}
