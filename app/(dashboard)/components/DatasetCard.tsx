import type { Dataset } from "@/lib/types";

type DatasetCardProps = {
  dataset: Dataset;
  active?: boolean;
  featured?: boolean;
  compact?: boolean;
};

export function DatasetCard({ dataset, active, featured, compact }: DatasetCardProps) {
  return (
    <article className={`dataset-card${active ? " active" : ""}${featured ? " featured" : ""}${compact ? " compact" : ""}`}>
      <div className="dataset-card-head">
        <div>
          <h3>{dataset.name}</h3>
          <p>{dataset.description}</p>
        </div>
        <span className={`status-pill status-${dataset.status}`}>{dataset.status}</span>
      </div>

      <div className="dataset-card-foot">
        <span>{dataset.source}</span>
        <strong>{dataset.rowCount.toLocaleString()} rows</strong>
      </div>

      {dataset.error ? <p className="dataset-error">{dataset.error}</p> : null}
    </article>
  );
}
