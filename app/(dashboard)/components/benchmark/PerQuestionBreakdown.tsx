// Per-question breakdown section: header + the mapped DetailRow list. Lifted
// verbatim from benchmarks/[id]/page.tsx L284-290. The page used `key={i}` for
// the rows (index keys) — preserved, since CompactQuestionResult has no stable
// id field and the list is static once loaded.

import type { CompactQuestionResult } from "@/client/opfs";
import DetailRow from "./DetailRow";

type PerQuestionBreakdownProps = {
  details: CompactQuestionResult[];
};

export default function PerQuestionBreakdown({ details }: PerQuestionBreakdownProps) {
  return (
    <>
      <h2 className="font-semibold mb-3">Per-Question Breakdown ({details.length})</h2>
      <div className="space-y-2">
        {details.map((q, i) => (
          <DetailRow key={i} q={q} idx={i} />
        ))}
      </div>
    </>
  );
}
