// Chunks section of the detail page: the "Chunks" header with document count
// and the mapped SourceCard list. Lifted verbatim from datasets/[id]/page.tsx
// L122-137. Delegates each chunk's rendering to the existing SourceCard.

import SourceCard from "../SourceCard";
import type { OpfsDocument } from "@/client/opfs";

type ChunksListProps = {
  chunks: OpfsDocument[];
};

export default function ChunksList({ chunks }: ChunksListProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Chunks</h2>
        <span className="text-sm text-muted">{chunks.length} documents</span>
      </div>
      {chunks.length === 0 ? (
        <p className="text-muted text-sm py-8 text-center">No chunks indexed yet.</p>
      ) : (
        <div>
          {chunks.map((source, idx) => (
            <SourceCard key={source.sourceKey} source={source} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
