"use client";

import PageShell from "@/app/(dashboard)/components/ui/PageShell";
import ErrorBanner from "@/app/(dashboard)/components/ui/ErrorBanner";
import BenchmarkImportForm from "@/app/(dashboard)/components/benchmark/BenchmarkImportForm";
import BenchmarkRunForm from "@/app/(dashboard)/components/benchmark/BenchmarkRunForm";
import QuestionSetList from "@/app/(dashboard)/components/benchmark/QuestionSetList";
import BenchmarkRunHistory from "@/app/(dashboard)/components/benchmark/BenchmarkRunHistory";
import { useBenchmarksData } from "@/app/(dashboard)/hooks/useBenchmarksData";
import { useBenchmarkRunner } from "@/app/(dashboard)/hooks/useBenchmarkRunner";
import { useDatasetImport } from "@/app/(dashboard)/hooks/useDatasetImport";
import { useDashboard } from "../components/DashboardProvider";

export default function BenchmarksPage() {
  const { preferences } = useDashboard();
  const { runs, datasets, questionSets, isInitialLoading, error, refetch } = useBenchmarksData();

  const importForm = useDatasetImport({ onImported: refetch });

  const runner = useBenchmarkRunner({
    datasets,
    onRunComplete: refetch,
    initialProvider: preferences.provider,
    initialModel: preferences.model,
  });

  return (
    <PageShell maxWidth={3}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Benchmarks</h1>
        <button
          onClick={importForm.toggleImport}
          className="text-sm font-medium px-4 py-2 bg-accent text-[#03111a] rounded-xl hover:bg-accent-hover transition-colors"
        >
          {importForm.showImport ? "Cancel Import" : "Import Questions"}
        </button>
      </div>

      {/* ── Import benchmark dataset ── */}
      {importForm.showImport && <BenchmarkImportForm form={importForm} />}

      {/* ── Run benchmark ── */}
      <BenchmarkRunForm form={runner} datasets={datasets} questionSets={questionSets} />

      {/* ── Question set list ── */}
      <QuestionSetList questionSets={questionSets} />

      {/* ── History ── */}
      <ErrorBanner message={error} className="mb-6" />
      <BenchmarkRunHistory runs={runs} loading={isInitialLoading && questionSets.length === 0} />
    </PageShell>
  );
}
