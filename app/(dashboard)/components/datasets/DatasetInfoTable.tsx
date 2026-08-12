// "Info" stat block at the bottom of the detail page: Source / Chunks /
// Rows / Created key-value rows. Lifted verbatim from datasets/[id]/page.tsx
// L140-160. Renders only — all values come from the OpfsDataset the page
// already holds.

import type { OpfsDataset } from "@/client/opfs";

type DatasetInfoTableProps = {
  dataset: Pick<OpfsDataset, "source" | "chunkCount" | "rowCount" | "createdAt">;
};

export default function DatasetInfoTable({ dataset }: DatasetInfoTableProps) {
  return (
    <div className="bg-bg-alt rounded-2xl border border-line p-6">
      <h2 className="font-semibold mb-4">Info</h2>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between py-2 border-b border-line/50">
          <span className="text-muted">Source</span>
          <span className="font-medium">{dataset.source}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-line/50">
          <span className="text-muted">Chunks</span>
          <span className="font-medium">{dataset.chunkCount}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-line/50">
          <span className="text-muted">Rows</span>
          <span className="font-medium">{dataset.rowCount}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-muted">Created</span>
          <span className="font-medium">{new Date(dataset.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
