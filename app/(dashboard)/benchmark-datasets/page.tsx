"use client";

import Link from "next/link";
import PageShell from "@/app/(dashboard)/components/ui/PageShell";
import ErrorBanner from "@/app/(dashboard)/components/ui/ErrorBanner";
import HfImportForm from "@/app/(dashboard)/components/benchmark-datasets/HfImportForm";
import QuestionSetRow from "@/app/(dashboard)/components/benchmark-datasets/QuestionSetRow";
import { PageListSkeleton } from "../components/Skeleton";
import { useQuestionSets } from "@/app/(dashboard)/hooks/useQuestionSets";
import { useHfImport } from "@/app/(dashboard)/hooks/useHfImport";

export default function BenchmarkDatasetsPage() {
  const { questionSets, error, isInitialLoading, refetch } = useQuestionSets();
  const importForm = useHfImport({ onImported: refetch });

  return (
    <PageShell maxWidth={2}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Question Sets</h1>
        <button
          onClick={importForm.toggleImport}
          className="text-sm font-medium px-4 py-2 bg-accent text-[#03111a] rounded-xl hover:bg-accent-hover transition-colors"
        >
          {importForm.showImport ? "Cancel" : "Import Questions"}
        </button>
      </div>

      {/* Import form */}
      {importForm.showImport && <HfImportForm form={importForm} />}

      {/* List-load error */}
      <ErrorBanner message={error} className="mb-6" />

      {isInitialLoading && questionSets.length === 0 ? (
        <PageListSkeleton itemCount={4} />
      ) : questionSets.length === 0 ? (
        <div className="bg-bg-alt border border-line rounded-2xl p-8 text-center">
          <p className="text-muted text-sm mb-2">No question sets yet.</p>
          <p className="text-xs text-muted">
            Import from HuggingFace or create from the{" "}
            <Link href="/benchmarks" className="text-accent hover:underline">
              benchmarks page
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questionSets.map((qs) => (
            <QuestionSetRow key={qs.id} qs={qs} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
