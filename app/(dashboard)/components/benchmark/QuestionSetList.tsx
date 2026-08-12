// The "Question Sets" card row beneath the run form. Lifted verbatim from
// benchmarks/page.tsx L448-477. Each row links to the benchmark-datasets detail
// page (the canonical home for question sets) and shows name, question count,
// source, and creation date. Only rendered when the page has question sets.

import Link from "next/link";
import type { BenchmarkQuestionSet } from "@/client/benchmark-questions";

type QuestionSetListProps = {
  questionSets: BenchmarkQuestionSet[];
};

export default function QuestionSetList({ questionSets }: QuestionSetListProps) {
  if (questionSets.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="font-semibold mb-3">Question Sets ({questionSets.length})</h2>
      <div className="space-y-2">
        {questionSets.map((qs) => (
          <Link
            key={qs.id}
            href={`/benchmark-datasets/${qs.id}`}
            className="block bg-bg-alt rounded-xl border border-line px-4 py-3 hover:border-accent/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-text">{qs.name}</span>
                <span className="text-xs text-muted ml-3">
                  {qs.questionCount} questions
                </span>
                <span className="text-xs text-muted ml-3">
                  {qs.source}
                </span>
              </div>
              <span className="text-xs text-muted">
                {new Date(qs.createdAt).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
