// One collapsible per-question row on the benchmark detail page. Lifted
// VERBATIM from benchmarks/[id]/page.tsx L93-172 — the toggle button, the
// "no answer"/"empty" status chip, ScoreBadge/LatencyBadge pairs in the body,
// the ground-truth / generated-answer / retrieved-docs blocks. Local `open`
// state stays in this leaf (it was local in the page's DetailRow too — same
// isolation). Uses the shared ScoreBadge/LatencyBadge so the badge variants
// match the rest of the detail page exactly.

"use client";

import { useState } from "react";
import type { CompactQuestionResult } from "@/client/opfs";
import ScoreBadge from "./ScoreBadge";
import LatencyBadge from "./LatencyBadge";

type DetailRowProps = {
  q: CompactQuestionResult;
  idx: number;
};

export default function DetailRow({ q, idx }: DetailRowProps) {
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
