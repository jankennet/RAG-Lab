import { Dataset } from "@/shared/types";

interface DatasetCardProps {
  dataset: Dataset;
}

export default function DatasetCard({ dataset }: DatasetCardProps) {
  const statusConfig: Record<string, string> = {
    ready: "bg-success/10 text-success border-success/20",
    loading: "bg-warning/10 text-warning border-warning/20",
    error: "bg-danger/10 text-danger border-danger/20",
  };

  return (
    <div className="bg-bg-alt rounded-2xl border border-line p-4 hover:border-accent/20 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-text">{dataset.name}</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusConfig[dataset.status]}`}>
          {dataset.status}
        </span>
      </div>
      {dataset.description && (
        <p className="text-muted text-sm mb-3 line-clamp-2">{dataset.description}</p>
      )}
      <div className="text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
        <span>Source: {dataset.source}</span>
        <span>Rows: {dataset.rowCount.toLocaleString()}</span>
        <span>Created: {new Date(dataset.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}