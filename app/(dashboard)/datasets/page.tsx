"use client";

import { useMemo, useState } from "react";
import { DatasetCard } from "../components/DatasetCard";
import { dashboardDatasets } from "@/lib/dashboard-data";

export default function DatasetsPage() {
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");

  const filtered = useMemo(
    () =>
      dashboardDatasets.filter((dataset) => {
        const haystack = `${dataset.name} ${dataset.description} ${dataset.source}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      }),
    [query]
  );

  return (
    <section className="page-stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Datasets</p>
          <h1 className="page-title">Bring data in.</h1>
          <p className="page-lede">Upload your own files, import from URL, or test public HF datasets before chat starts.</p>
        </div>

        <div className="page-actions">
          <input className="field-input field-input-soft" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search datasets" />
        </div>
      </div>

      <div className="dataset-grid">
        <div className="dataset-main">
          {filtered.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </div>

        <div className="dataset-side">
          <div className="panel-surface stack-panel">
            <h2>Upload files</h2>
            <p className="muted-copy">Drop CSV, JSONL, or TXT. Backend hook can land later. UI first.</p>
            <div className="upload-box">
              <input type="file" multiple onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} />
              {fileName ? <span>{fileName}</span> : <span>No file selected</span>}
            </div>
          </div>

          <div className="panel-surface stack-panel">
            <h2>Import from URL</h2>
            <p className="muted-copy">Paste raw file or dataset URL. Later can connect import API.</p>
            <input className="field-input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
            <button className="primary-button" type="button">Preview source</button>
          </div>
        </div>
      </div>
    </section>
  );
}
