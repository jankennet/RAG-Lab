// One question-set row in the benchmark-datasets list. Lifted verbatim from
// benchmark-datasets/page.tsx L233-252. The whole card is a <Link> to the
// detail page; the "HF source" link inside stops propagation so it doesn't
// navigate the card — opens in a new tab with noopener/noreferrer. Keep both
// navigations intact (card → detail, source link → external).

"use client";

import Link from "next/link";
import type { BenchmarkQuestionSet } from "@/client/benchmark-questions";

type QuestionSetRowProps = {
  qs: BenchmarkQuestionSet;
};

export default function QuestionSetRow({ qs }: QuestionSetRowProps) {
  return (
    <Link
      key={qs.id}
      href={`/benchmark-datasets/${qs.id}`}
      className="block bg-bg-alt rounded-2xl border border-line p-5 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-text">{qs.name}</h3>
        <span className="text-xs text-muted">{qs.source}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted">
        <span>{qs.questionCount} questions</span>
        <span>Created {new Date(qs.createdAt).toLocaleDateString()}</span>
        {qs.sourceUrl && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              window.open(qs.sourceUrl!, "_blank", "noopener,noreferrer");
            }}
            className="text-accent hover:underline cursor-pointer"
          >
            HF source
          </span>
        )}
      </div>
    </Link>
  );
}
