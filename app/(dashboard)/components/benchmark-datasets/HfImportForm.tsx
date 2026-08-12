// HuggingFace import form for the benchmark-datasets (Question Sets) page.
// Renders the `useHfImport` (→ `useDatasetImport`) state inside the collapsible
// card the page toggles. Lifted verbatim from benchmark-datasets/page.tsx
// L109-211 — same heading ("Import from HuggingFace"), same helper copy +
// `galileo-ai/ragbench` example, same 3-col subset/split/max-rows grid, same
// "(optional)" hint text on the question/answer fields. The form state lives
// in the hook; this leaf calls `importQuestions`. Sibling of
// BenchmarkImportForm (Phase 4) — same FIELD_CLASS, different copy/grid.

"use client";

import type { DatasetImportForm } from "@/app/(dashboard)/hooks/useDatasetImport";

type HfImportFormProps = {
  form: DatasetImportForm;
};

const FIELD_CLASS =
  "w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors";

export default function HfImportForm({ form }: HfImportFormProps) {
  return (
    <div className="bg-bg-alt rounded-2xl border border-line p-6 mb-8">
      <h2 className="font-semibold mb-1">Import from HuggingFace</h2>
      <p className="text-sm text-muted mb-4">
        Import question/answer pairs from a HF benchmark dataset.
        Auto-detects question/answer fields.
        Example: <code className="text-accent">galileo-ai/ragbench</code>
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
        <div className="grid grid-cols-3 gap-3">
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
              Question Field <span className="text-muted/50">(optional)</span>
            </label>
            <input
              type="text"
              value={form.importQuestionField}
              onChange={(e) => form.setImportQuestionField(e.target.value)}
              className={FIELD_CLASS}
              placeholder="auto-detect"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Answer Field <span className="text-muted/50">(optional)</span>
            </label>
            <input
              type="text"
              value={form.importAnswerField}
              onChange={(e) => form.setImportAnswerField(e.target.value)}
              className={FIELD_CLASS}
              placeholder="auto-detect"
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
          {form.importing ? "Importing..." : "Import"}
        </button>
      </form>
    </div>
  );
}
