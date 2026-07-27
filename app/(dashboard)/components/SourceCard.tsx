import type { RagDocument } from "@/lib/types";

type SourceCardProps = {
  source: RagDocument;
  rank: number;
  compact?: boolean;
};

export function SourceCard({ source, rank, compact }: SourceCardProps) {
  return (
    <article className={`source-card${compact ? " compact" : ""}`}>
      <div className="source-card-head">
        <span>#{rank}</span>
        <strong>{source.title}</strong>
      </div>
      <p>{source.content}</p>
      <footer>
        <span>{source.sourceName}</span>
        <span>{source.similarity?.toFixed(3) ?? "n/a"}</span>
      </footer>
    </article>
  );
}
