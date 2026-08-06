"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { loadQuestionSets, createQuestionSet, saveQuestions } from "@/client/benchmark-questions";
import type { BenchmarkQuestionSet } from "@/client/benchmark-questions";

export default function BenchmarkDatasetsPage() {
  const [questionSets, setQuestionSets] = useState<BenchmarkQuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import form
  const [showImport, setShowImport] = useState(false);
  const [importName, setImportName] = useState("");
  const [importDatasetId, setImportDatasetId] = useState("");
  const [importConfig, setImportConfig] = useState("default");
  const [importSplit, setImportSplit] = useState("train");
  const [importMaxRows, setImportMaxRows] = useState("200");
  const [importQuestionField, setImportQuestionField] = useState("");
  const [importAnswerField, setImportAnswerField] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sets = await loadQuestionSets();
      setQuestionSets(sets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load question sets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importName.trim() || !importDatasetId.trim()) return;

    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/benchmark-datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: importName.trim(),
          datasetName: importDatasetId.trim(),
          datasetConfig: importConfig.trim(),
          datasetSplit: importSplit.trim(),
          maxRows: parseInt(importMaxRows, 10) || 200,
          ...(importQuestionField ? { questionField: importQuestionField.trim() } : {}),
          ...(importAnswerField ? { answerField: importAnswerField.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Import failed");
      }

      const set = await createQuestionSet({
        name: data.name,
        source: "huggingface",
        sourceUrl: data.sourceUrl,
      });
      const questions = data.questions.map((q: Record<string, unknown>, i: number) => ({
        id: `${i}`,
        question: q.question as string,
        groundTruth: q.groundTruth as string,
        category: q.category as string | undefined,
        metadata: q.metadata as Record<string, unknown> | undefined,
      }));
      await saveQuestions(set.id, questions);

      setShowImport(false);
      setImportName("");
      setImportDatasetId("");

      await fetchData();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Question Sets</h1>
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-sm font-medium px-4 py-2 bg-accent text-[#03111a] rounded-xl hover:bg-accent-hover transition-colors"
          >
            {showImport ? "Cancel" : "Import Questions"}
          </button>
        </div>

        {/* Import form */}
        {showImport && (
          <div className="bg-bg-alt rounded-2xl border border-line p-6 mb-8">
            <h2 className="font-semibold mb-1">Import from HuggingFace</h2>
            <p className="text-sm text-muted mb-4">
              Import question/answer pairs from a HF benchmark dataset.
              Auto-detects question/answer fields.
              Example: <code className="text-accent">galileo-ai/ragbench</code>
            </p>
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">Name</label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                  placeholder="e.g., RAG Bench QA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">HF Dataset ID</label>
                <input
                  type="text"
                  value={importDatasetId}
                  onChange={(e) => setImportDatasetId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                  placeholder="galileo-ai/ragbench"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Subset</label>
                  <input
                    type="text"
                    value={importConfig}
                    onChange={(e) => setImportConfig(e.target.value)}
                    className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                    placeholder="default"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Split</label>
                  <input
                    type="text"
                    value={importSplit}
                    onChange={(e) => setImportSplit(e.target.value)}
                    className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                    placeholder="train"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Max Rows</label>
                  <input
                    type="number"
                    value={importMaxRows}
                    onChange={(e) => setImportMaxRows(e.target.value)}
                    min={1}
                    max={5000}
                    className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
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
                    value={importQuestionField}
                    onChange={(e) => setImportQuestionField(e.target.value)}
                    className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                    placeholder="auto-detect"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Answer Field <span className="text-muted/50">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={importAnswerField}
                    onChange={(e) => setImportAnswerField(e.target.value)}
                    className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                    placeholder="auto-detect"
                  />
                </div>
              </div>
              {importError && (
                <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{importError}</p>
              )}
              <button
                type="submit"
                disabled={importing}
                className="w-full px-4 py-2.5 bg-accent text-[#03111a] font-semibold rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </form>
          </div>
        )}

        {/* List */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-muted text-center py-12">Loading...</p>
        ) : questionSets.length === 0 ? (
          <div className="bg-bg-alt border border-line rounded-2xl p-8 text-center">
            <p className="text-muted text-sm mb-2">No question sets yet.</p>
            <p className="text-xs text-muted">
              Import from HuggingFace or create from the{" "}
              <Link href="/benchmarks" className="text-accent hover:underline">benchmarks page</Link>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questionSets.map((qs) => (
              <Link
                key={qs.id}
                href={`/benchmark-datasets/${qs.id}`}
                className="block bg-bg-alt rounded-2xl border border-line p-5 hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-text">{qs.name}</h3>
                  <span className="text-xs text-muted">{qs.source}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>{qs.questionCount} questions</span>
                  <span>Created {new Date(qs.createdAt).toLocaleDateString()}</span>
                  {qs.sourceUrl && (
                    <span onClick={(e) => { e.stopPropagation(); window.open(qs.sourceUrl!, '_blank', 'noopener,noreferrer'); }} className="text-accent hover:underline cursor-pointer">
                      HF source
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}