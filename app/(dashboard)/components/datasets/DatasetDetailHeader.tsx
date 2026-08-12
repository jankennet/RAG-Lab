// Detail-page header: the dataset name, source + link, and the Re-index
// button. Lifted verbatim from datasets/[id]/page.tsx L83-106. The reindex
// handler and its in-flight flag come from useDatasetDetail — this leaf renders
// state, owns no logic.

import type { OpfsDataset } from "@/client/opfs";

type DatasetDetailHeaderProps = {
  dataset: Pick<OpfsDataset, "name" | "source" | "sourceUrl">;
  reindexing: boolean;
  onReindex: () => void;
};

export default function DatasetDetailHeader({
  dataset,
  reindexing,
  onReindex,
}: DatasetDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <p className="text-xs text-muted mb-1">Dataset detail</p>
        <h1 className="text-2xl font-bold">{dataset.name}</h1>
        <p className="text-sm text-muted mt-1">
          Source: {dataset.source}
          {dataset.sourceUrl && (
            <>
              {" · "}
              <a href={dataset.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Link
              </a>
            </>
          )}
        </p>
      </div>
      <button
        onClick={onReindex}
        disabled={reindexing}
        className="px-4 py-2 text-sm font-medium bg-accent/10 border border-accent/20 text-accent rounded-xl hover:bg-accent/15 transition-colors disabled:opacity-40"
      >
        {reindexing ? "Reindexing..." : "Re-index"}
      </button>
    </div>
  );
}
