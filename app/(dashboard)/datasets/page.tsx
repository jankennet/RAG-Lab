"use client";

import Link from "next/link";
import DatasetCard from "@/app/(dashboard)/components/DatasetCard";
import { PageListSkeleton } from "@/app/(dashboard)/components/Skeleton";
import PageShell from "@/app/(dashboard)/components/ui/PageShell";
import ErrorBanner from "@/app/(dashboard)/components/ui/ErrorBanner";
import DatasetAddForm from "@/app/(dashboard)/components/datasets/DatasetAddForm";
import DeleteDatasetButton from "@/app/(dashboard)/components/datasets/DeleteDatasetButton";
import { useDatasetsList } from "@/app/(dashboard)/hooks/useDatasetsList";
import { toDataset } from "@/app/(dashboard)/lib/datasets/toDataset";
import { useState } from "react";

export default function DatasetsPage() {
  const { datasets, isInitialLoading, refetch, remove } = useDatasetsList();
  // Delete errors route to the same form banner slot the page always used.
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dataset?")) return;
    setDeleteError(null);
    try {
      await remove(id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Form/header interactive no matter what — only the list section skips until
  // data lands. This keeps Add Dataset usable while OPFS reads in the background.
  const showListSkeleton = isInitialLoading && datasets.length === 0;

  return (
    <PageShell maxWidth={2}>
      <h1 className="text-2xl font-bold mb-8">Datasets</h1>

      {/* Add form — independent of dataset list loader */}
      <DatasetAddForm onAdded={refetch} />

      {/* Dataset list — skeleton only on first load, content streams in once ready */}
      {showListSkeleton ? (
        <PageListSkeleton itemCount={4} />
      ) : datasets.length === 0 ? (
        <p className="text-muted text-center py-12">No datasets yet. Add one above</p>
      ) : (
        <div>
          <h2 className="font-semibold mb-4">Your Datasets ({datasets.length})</h2>
          <div className="space-y-3">
            {datasets.map((dataset) => (
              <div key={dataset.id} className="relative group">
                <Link href={`/datasets/${dataset.id}`}>
                  <DatasetCard dataset={toDataset(dataset)} />
                </Link>
                <DeleteDatasetButton onDelete={() => handleDelete(dataset.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <ErrorBanner message={deleteError} className="mt-4" />
    </PageShell>
  );
}
