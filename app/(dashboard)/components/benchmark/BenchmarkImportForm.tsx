// Import-questions form for the benchmarks page: name + HF dataset id +
// subset/split/max-rows + optional question/answer fields, all inside the
// collapsible card toggled by `useDatasetImport.showImport`. The state lives in
// the hook; this leaf renders it and calls `importQuestions`. Lifted verbatim
// from benchmarks/page.tsx L241-345 — class-for-class, same grid layout, same
// optional-field "(optional — auto-detect)" hint text. Uses shared constants
// for the max-rows ceiling so it can't drift from the benchmark-datasets form.

"use client";

import type { DatasetImportForm } from "@/app/(dashboard)/hooks/useDatasetImport";

type BenchmarkImportFormProps = {
  form: DatasetImportForm;
};

const FIELD_CLASS =
  "w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors";

export default function BenchmarkImportForm({ form }: BenchmarkImportFormProps) {
  return (
    <div className="bg-bg-alt rounded-2xl border border-line p-6 mb-8">
      <h2 className="font-semibold mb-1">Import Benchmark Questions</h2>
      <p className="text-sm text-muted mb-4">
        Import question/answer pairs from a HuggingFace benchmark dataset (e.g.,{" "}
        <code className="text-accent">galileo-ai/ragbench</code>).
        Auto-detects question and answer fields.
      </p>
      <form onSubmit={form.importQuestions} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1.5">Name</label>
          <input
            type="text"
            value={form.importName}
            onChange={(e) => form.setImportName(e.target.value)}
            required
            className={FIELD_CLASS}
            placeholder="e.g., RAG Bench QA"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1.5">HF Dataset ID</label>
          <input
            type="text"
            value={form.importDatasetId}
            onChange={(e) => form.setImportDatasetId(e.target.value)}
            required
            className={FIELD_CLASS}
            placeholder="galileo-ai/ragbench"
          />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Subset</label>
            <input
              type="text"
              value={form.importConfig}
              onChange={(e) => form.setImportConfig(e.target.value)}
              className={FIELD_CLASS}
              placeholder="default"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Split</label>
            <input
              type="text"
              value={form.importSplit}
              onChange={(e) => form.setImportSplit(e.target.value)}
              className={FIELD_CLASS}
              placeholder="train"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Max Rows</label>
            <input
              type="number"
              value={form.importMaxRows}
              onChange={(e) => form.setImportMaxRows(e.target.value)}
              min={form.minRows}
              max={form.maxRows}
              className={FIELD_CLASS}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Question Field <span className="text-muted/50">(optional — auto-detect)</span>
            </label>
            <input
              type="text"
              value={form.importQuestionField}
              onChange={(e) => form.setImportQuestionField(e.target.value)}
              className={FIELD_CLASS}
              placeholder="question"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Answer Field <span className="text-muted/50">(optional — auto-detect)</span>
            </label>
            <input
              type="text"
              value={form.importAnswerField}
              onChange={(e) => form.setImportAnswerField(e.target.value)}
              className={FIELD_CLASS}
              placeholder="answer"
            />
          </div>
        </div>

        {form.importError && (
          <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{form.importError}</p>
        )}

        <button
          type="submit"
          disabled={form.importing}
          className="w-full px-4 py-2.5 bg-accent text-[#03111a] font-semibold rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {form.importing ? "Importing..." : "Import Benchmark Questions"}
        </button>
      </form>
    </div>
  );
}
