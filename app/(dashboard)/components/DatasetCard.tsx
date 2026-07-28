import { Dataset } from "@/lib/types";

interface DatasetCardProps {
  dataset: Dataset;
}

export default function DatasetCard({ dataset }: DatasetCardProps) {
  const statusColors: Record<string, string> = {
    ready: "bg-green-500/20 text-green-400",
    loading: "bg-yellow-500/20 text-yellow-400",
    error: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-text">{dataset.name}</h3>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[dataset.status] || ""}`}
        >
          {dataset.status}
        </span>
      </div>
      <p className="text-muted mb-2 line-clamp-2">{dataset.description}</p>
      <div className="text-xs text-muted flex-wrap gap-2">
        <span>Source: {dataset.source}</span>
        {dataset.sourceUrl && (
          <span>
            | <a href={dataset.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Link
            </a>
          </span>
        )}
        <span>Rows: {dataset.rowCount.toLocaleString()}</span>
        <span>Created: {new Date(dataset.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
