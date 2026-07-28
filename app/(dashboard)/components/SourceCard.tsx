import { RagDocument } from "@/shared/types";

interface SourceCardProps {
  source: RagDocument;
  index: number;
}

export default function SourceCard({ source, index }: SourceCardProps) {
  return (
    <div className="bg-bg-alt border border-line rounded-xl p-4 mb-3 last:mb-0">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 h-7 w-7 bg-accent/20 text-accent rounded-lg flex items-center justify-center text-xs font-bold">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{source.title || `Chunk ${source.chunkIndex}`}</h3>
          <p className="text-xs text-muted truncate">{source.sourceName}</p>
          {source.sourceUrl && (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline mt-0.5 inline-block truncate max-w-full"
            >
              {source.sourceUrl}
            </a>
          )}
        </div>
      </div>
      <p className="text-sm text-muted whitespace-pre-line line-clamp-6">{source.content}</p>
      {source.similarity !== undefined && (
        <div className="mt-3 pt-3 border-t border-line flex justify-between items-center text-xs text-muted">
          <span>Chunk #{source.chunkIndex}</span>
          <span>{(source.similarity * 100).toFixed(1)}% match</span>
        </div>
      )}
    </div>
  );
}