// Add Dataset form: the white card wrapping name + source toggle + either the
// HuggingFace fields or the upload dropzone, plus the error/progress banners
// and the submit button. Lifted from datasets/page.tsx L363-567, swapping the
// inline handlers for `useDatasetAddForm` state and the two field subcomponents.
// The `onAdded` callback lets the page refetch its list after a successful add.
// JSX + Tailwind kept class-for-class so the form looks and behaves identical.

"use client";

import type { FormEvent } from "react";
import { useDatasetAddForm, type DatasetAddSource } from "@/app/(dashboard)/hooks/useDatasetAddForm";
import HfDatasetFields from "./HfDatasetFields";
import UploadDropzone from "./UploadDropzone";

type DatasetAddFormProps = {
  onAdded?: () => void;
};

const FIELD_CLASS =
  "w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors";

export default function DatasetAddForm({ onAdded }: DatasetAddFormProps) {
  const f = useDatasetAddForm({ onAdded });

  const handleSubmit = (e: FormEvent) => {
    void f.submit(e);
  };

  return (
    <div className="bg-bg-alt rounded-2xl border border-line p-6 mb-8">
      <h2 className="font-semibold mb-4">Add New Dataset</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1.5">Dataset Name</label>
          <input
            type="text"
            value={f.name}
            onChange={(e) => f.setName(e.target.value)}
            required
            className={FIELD_CLASS}
            placeholder="e.g., My Knowledge Base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1.5">Source</label>
          <select
            value={f.source}
            onChange={(e) => f.changeSource(e.target.value as DatasetAddSource)}
            className={FIELD_CLASS}
          >
            <option value="huggingface">HuggingFace</option>
            <option value="upload">Upload Files</option>
          </select>
        </div>

        {/* ── HuggingFace fields ── */}
        {f.source === "huggingface" && (
          <HfDatasetFields
            hfDatasetId={f.hfDatasetId}
            onHfDatasetIdChange={f.setHfDatasetId}
            hfConfig={f.hfConfig}
            onHfConfigChange={f.setHfConfig}
            hfConfigs={f.hfConfigs}
            hfConfigsLoading={f.hfConfigsLoading}
            hfSplit={f.hfSplit}
            onHfSplitChange={f.setHfSplit}
            hfSplits={f.hfSplits}
            hfSplitsLoading={f.hfSplitsLoading}
            hfMaxRows={f.hfMaxRows}
            onHfMaxRowsChange={f.setHfMaxRows}
          />
        )}

        {/* ── Multi-file upload drop zone ── */}
        {f.source === "upload" && (
          <UploadDropzone
            selectedFiles={f.selectedFiles}
            onAddFiles={f.addFiles}
            onRemoveFile={f.removeFile}
            onClearFiles={f.clearFiles}
          />
        )}

        {/* Error */}
        {f.error && (
          <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{f.error}</p>
        )}

        {/* Progress */}
        {f.progress && (
          <p className="text-accent text-sm bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">{f.progress}</p>
        )}

        <button
          type="submit"
          disabled={f.isAdding}
          className="w-full px-4 py-2.5 bg-accent text-[#03111a] font-semibold rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {f.isAdding ? "Adding..." : "Add Dataset"}
        </button>
      </form>
    </div>
  );
}
