// "History" section: skeleton-while-loading → empty state → mapped run cards.
// Lifted verbatim from benchmarks/page.tsx L486-548. The skeleton gate is the
// page's "loading AND questionSets empty" rule — odd but intentional: the
// benchmark history table skeleton only shows before the first fetch resolves
// both runs and question sets. Preserved as-is. The list-level error is a
// separate banner the page renders above this.

import { PageTableSkeleton } from "../Skeleton";
import BenchmarkRunCard from "./BenchmarkRunCard";
import type { BenchmarkRun } from "@/client/opfs";

type BenchmarkRunHistoryProps = {
  runs: BenchmarkRun[];
  loading: boolean;
};

export default function BenchmarkRunHistory({ runs, loading }: BenchmarkRunHistoryProps) {
  if (loading && runs.length === 0) {
    return <PageTableSkeleton />;
  }

  if (runs.length === 0) {
    return (
      <p className="text-muted text-center py-12">
        No benchmarks yet. Import a question set and trigger one above!
      </p>
    );
  }

  return (
    <div>
      <h2 className="font-semibold mb-4">History ({runs.length})</h2>
      <div className="space-y-3">
        {runs.map((run) => (
          <BenchmarkRunCard key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
}
