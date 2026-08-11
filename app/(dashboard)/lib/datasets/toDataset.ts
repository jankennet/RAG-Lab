// OpfsDataset → Dataset adapter. Previously inlined identically in both
// datasets/page.tsx and datasets/[id]/page.tsx to feed the presentational
// DatasetCard, which expects the shared `Dataset` shape.

import type { Dataset } from "@/shared/types";
import type { OpfsDataset } from "@/client/opfs";

/** Map an OPFS dataset record to the shared `Dataset` type for display. */
export function toDataset(ds: OpfsDataset): Dataset {
  return {
    id: ds.id,
    name: ds.name,
    description: `${ds.chunkCount} chunks · ${ds.source}`,
    source: ds.source,
    sourceUrl: ds.sourceUrl ?? undefined,
    rowCount: ds.rowCount,
    createdAt: ds.createdAt,
    status: "ready",
  };
}
