import { RagDocument } from "@/lib/types";

interface SourceCardProps {
  source: RagDocument;
  index: number;
}

export default function SourceCard({ source, index }: SourceCardProps) {
  return (
    <div className="bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-4 mb-3">
      <div className="flex items-start mb-2">
        <div className="flex-shrink-0">
          <div className="h-8 w-8 bg-accent rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">{index + 1}</span>
          </div>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="font-semibold text-text">{source.title}</h3>
          <p className="text-muted mb-1">{source.sourceName}</p>
          {source.sourceUrl && (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {source.sourceUrl}
            </a>
          )}
        </div>
      </div>
      <div className="border-t border-line pt-3">
        <p className="text-muted whitespace-pre-line">{source.content}</p>
        {source.similarity !== undefined && (
          <div className="mt-2 text-xs text-muted flex justify-end">
            Similarity: {(source.similarity * 100).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}
