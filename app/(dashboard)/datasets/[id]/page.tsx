import { notFound } from "next/navigation";
import { DatasetCard } from "../../components/DatasetCard";
import { SourceCard } from "../../components/SourceCard";
import { dashboardDatasets, getDatasetById } from "@/lib/dashboard-data";

export default function DatasetDetailPage({ params }: { params: { id: string } }) {
  const dataset = getDatasetById(params.id);

  if (!dataset) {
    notFound();
  }

  return (
    <section className="page-stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Dataset detail</p>
          <h1 className="page-title">{dataset.name}</h1>
          <p className="page-lede">Inspect ingestion, source lineage, and chunk readiness before chat uses corpus.</p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="panel-surface detail-main">
          <DatasetCard dataset={dataset} featured />
          <div className="section-head split-head">
            <h2>Source chunks</h2>
            <span>{dataset.rowCount} rows</span>
          </div>
          <div className="source-stack">
            {dashboardDatasets.map((source) => (
              <SourceCard
                key={source.id}
                source={{
                  id: Number(source.rowCount),
                  sourceKey: source.id,
                  sourceName: source.name,
                  sourceUrl: source.sourceUrl ?? null,
                  title: source.name,
                  content: source.description,
                  metadata: { source: source.source },
                  chunkIndex: 0,
                  similarity: source.status === "ready" ? 0.94 : 0.57
                }}
                rank={1}
              />
            ))}
          </div>
        </div>

        <div className="detail-side">
          <div className="panel-surface stack-panel">
            <h2>Ingestion status</h2>
            <p className="muted-copy">Use this page to verify chunking, schema mapping, and retrieval quality.</p>
            <div className="status-list">
              <div><span>Source</span><strong>{dataset.source}</strong></div>
              <div><span>Rows</span><strong>{dataset.rowCount}</strong></div>
              <div><span>Status</span><strong>{dataset.status}</strong></div>
            </div>
          </div>

          <div className="panel-surface stack-panel">
            <h2>Next move</h2>
            <p className="muted-copy">Hook dataset validation API, then auto-start benchmark run from this view.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
