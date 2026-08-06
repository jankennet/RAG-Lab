"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { loadIndex, loadDocuments, loadBenchmarkRuns, saveBenchmarkRun } from "@/client/opfs";
import type { OpfsDataset, BenchmarkRun, BenchmarkMetrics } from "@/client/opfs";
import {
  loadQuestionSets,
  loadQuestions,
  createQuestionSet,
  saveQuestions,
} from "@/client/benchmark-questions";
import type { BenchmarkQuestionSet, BenchmarkQuestion } from "@/client/benchmark-questions";
import { useDashboard } from "../components/DashboardProvider";
import ModelSelector from "../components/ModelSelector";

function ScoreBadge({ score }: { score: number }) {
  const pct = (score * 100).toFixed(1);
  const color =
    score >= 0.7 ? "text-success" :
    score >= 0.4 ? "text-warning" :
    "text-danger";
  return <span className={`font-mono text-xs font-medium ${color}`}>{pct}%</span>;
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function BenchmarksPage() {
  const { preferences, apiKeys } = useDashboard();
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [datasets, setDatasets] = useState<OpfsDataset[]>([]);
  const [questionSets, setQuestionSets] = useState<BenchmarkQuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Benchmark run form
  const [datasetId, setDatasetId] = useState("");
  const [questionSetId, setQuestionSetId] = useState("");
  const [limit, setLimit] = useState(10);
  const [benchProvider, setBenchProvider] = useState(preferences.provider);
  const [benchModel, setBenchModel] = useState(preferences.model);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  // Import benchmark dataset form
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

  // Progress
  const RUN_PHASES = [
    "Loading benchmark questions & KB documents...",
    "Retrieving relevant context...",
    "Evaluating retrieval quality with LLM...",
    "Generating answers & scoring against ground truth...",
    "Crunching final metrics...",
  ];
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const phaseInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!triggering) {
      if (phaseInterval.current) clearInterval(phaseInterval.current);
      phaseInterval.current = null;
      return;
    }
    setPhaseIdx(0);
    setProgress(0);

    phaseInterval.current = setInterval(() => {
      setPhaseIdx((p) => {
        if (p >= RUN_PHASES.length - 1) return Math.max(RUN_PHASES.length - 3, p);
        return p + 1;
      });
      setProgress((p) => Math.min(p + 0.12, 0.9));
    }, 2200);

    return () => {
      if (phaseInterval.current) clearInterval(phaseInterval.current);
    };
  }, [triggering, RUN_PHASES.length]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runs, index, qSets] = await Promise.all([
        loadBenchmarkRuns(),
        loadIndex(),
        loadQuestionSets(),
      ]);
      setRuns(runs);
      setDatasets(index);
      setQuestionSets(qSets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Import benchmark dataset from HuggingFace ──────────

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

      // Save to OPFS
      const set = await createQuestionSet({
        name: data.name,
        source: "huggingface",
        sourceUrl: data.sourceUrl,
      });
      const questions: BenchmarkQuestion[] = data.questions.map((q: Record<string, unknown>, i: number) => ({
        id: `${i}`,
        question: q.question as string,
        groundTruth: q.groundTruth as string,
        category: q.category as string | undefined,
        metadata: q.metadata as Record<string, unknown> | undefined,
      }));
      await saveQuestions(set.id, questions);

      // Reset form
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

  // ── Run benchmark ─────────────────────────────────────

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datasetId || !questionSetId) return;

    setTriggering(true);
    setTriggerError(null);
    try {
      const dataset = datasets.find((d) => d.id === datasetId);
      const qSet = questionSets.find((q) => q.id === questionSetId);
      const [docs, questions] = await Promise.all([
        loadDocuments(datasetId),
        loadQuestions(questionSetId),
      ]);

      const selectedQuestions = questions.slice(0, limit);

      const res = await fetch("/api/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          datasetName: dataset?.name ?? "Unknown",
          questions: selectedQuestions.map((q) => ({
            question: q.question,
            groundTruth: q.groundTruth,
          })),
          documents: docs,
          provider: benchProvider,
          model: benchModel,
          apiKey: apiKeys[benchProvider],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }

      // Save to OPFS
      await saveBenchmarkRun(data);

      await fetchData();
      setProgress(1);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Failed to run benchmark");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Benchmarks</h1>
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-sm font-medium px-4 py-2 bg-accent text-[#03111a] rounded-xl hover:bg-accent-hover transition-colors"
          >
            {showImport ? "Cancel Import" : "Import Questions"}
          </button>
        </div>

        {/* ── Import benchmark dataset ── */}
        {showImport && (
          <div className="bg-bg-alt rounded-2xl border border-line p-6 mb-8">
            <h2 className="font-semibold mb-1">Import Benchmark Questions</h2>
            <p className="text-sm text-muted mb-4">
              Import question/answer pairs from a HuggingFace benchmark dataset (e.g.,{" "}
              <code className="text-accent">galileo-ai/ragbench</code>).
              Auto-detects question and answer fields.
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
              <div className="grid grid-cols-4 gap-3">
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
                    Question Field <span className="text-muted/50">(optional — auto-detect)</span>
                  </label>
                  <input
                    type="text"
                    value={importQuestionField}
                    onChange={(e) => setImportQuestionField(e.target.value)}
                    className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                    placeholder="question"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Answer Field <span className="text-muted/50">(optional — auto-detect)</span>
                  </label>
                  <input
                    type="text"
                    value={importAnswerField}
                    onChange={(e) => setImportAnswerField(e.target.value)}
                    className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                    placeholder="answer"
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
                {importing ? "Importing..." : "Import Benchmark Questions"}
              </button>
            </form>
          </div>
        )}

        {/* ── Run benchmark ── */}
        <div className="bg-bg-alt rounded-2xl border border-line p-6 mb-8">
          <h2 className="font-semibold mb-2">Run Benchmark</h2>
          <p className="text-sm text-muted mb-6">
            Select a Knowledge Base dataset + a Question Set with ground truth answers.
            Scores: faithfulness, relevance, context utilization (LLM-judged),
            token F1 (answer vs ground truth), and latency.
          </p>
          <form onSubmit={handleTrigger} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  Knowledge Base Dataset
                </label>
                <select
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                >
                  <option value="">Select KB dataset...</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.rowCount.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  Benchmark Question Set
                </label>
                <select
                  value={questionSetId}
                  onChange={(e) => setQuestionSetId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                >
                  <option value="">Select question set...</option>
                  {questionSets.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name} ({q.questionCount} questions)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Question Limit</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                min={1}
                max={200}
                className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-muted">Model</label>
              <ModelSelector
                provider={benchProvider}
                model={benchModel}
                apiKey={apiKeys[benchProvider]}
                onProviderChange={setBenchProvider}
                onModelChange={setBenchModel}
              />
            </div>
            {triggerError && (
              <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {triggerError}
              </p>
            )}
            <button
              type="submit"
              disabled={triggering || !datasetId || !questionSetId}
              className="w-full px-4 py-2.5 bg-accent text-[#03111a] font-semibold rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {triggering ? "Running..." : "Run Benchmark"}
            </button>
          </form>

          {triggering && (
            <div className="mt-6 bg-[#03111a] border border-accent/20 rounded-2xl p-5 overflow-hidden relative">
              <div className="h-2 bg-bg rounded-full overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-3 min-h-[2.5rem]">
                <span className="text-accent font-mono text-sm animate-pulse">
                  {RUN_PHASES[phaseIdx]}
                </span>
              </div>
              <p className="text-xs text-muted mt-3 font-mono">
                &gt; Benchmarking {limit} questions with {benchProvider}/{benchModel}
              </p>
            </div>
          )}
        </div>

        {/* ── Question set list ── */}
        {questionSets.length > 0 && (
          <div className="mb-8">
            <h2 className="font-semibold mb-3">Question Sets ({questionSets.length})</h2>
            <div className="space-y-2">
              {questionSets.map((qs) => (
                <Link
                  key={qs.id}
                  href={`/benchmark-datasets/${qs.id}`}
                  className="block bg-bg-alt rounded-xl border border-line px-4 py-3 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-text">{qs.name}</span>
                      <span className="text-xs text-muted ml-3">
                        {qs.questionCount} questions
                      </span>
                      <span className="text-xs text-muted ml-3">
                        {qs.source}
                      </span>
                    </div>
                    <span className="text-xs text-muted">
                      {new Date(qs.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── History ── */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-muted text-center py-12">Loading benchmarks...</p>
        ) : runs.length === 0 ? (
          <p className="text-muted text-center py-12">
            No benchmarks yet. Import a question set and trigger one above!
          </p>
        ) : (
          <div>
            <h2 className="font-semibold mb-4">History ({runs.length})</h2>
            <div className="space-y-3">
              {runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/benchmarks/${run.id}`}
                  className="block bg-bg-alt rounded-2xl border border-line p-5 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm">{run.datasetName}</h3>
                      <p className="text-xs text-muted mt-0.5">
                        {new Date(run.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted mt-0.5 font-mono">
                        {run.provider}/{run.model}
                      </p>
                    </div>
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                      run.status === "completed" ? "bg-success/10 border-success/20 text-success" :
                      "bg-muted/10 border-muted/20 text-muted"
                    }`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted mb-3">{run.totalQuestions} questions</div>
                  {run.metrics && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 border-t border-line">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">Latency</span>
                        <span className="font-mono text-xs font-medium">{formatMs(run.metrics.latencyMs)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">Token F1</span>
                        <ScoreBadge score={run.metrics.tokenF1} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">Faithfulness</span>
                        <ScoreBadge score={run.metrics.faithfulness} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">Relevance</span>
                        <ScoreBadge score={run.metrics.answerRelevance} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">Context Util</span>
                        <ScoreBadge score={run.metrics.contextUtilization} />
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}