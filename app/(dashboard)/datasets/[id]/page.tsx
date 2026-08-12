"use client";

import { useParams } from "next/navigation";
import DatasetCard from "../../components/DatasetCard";
import { PageDetailSkeleton } from "../../components/Skeleton";
import PageShell from "@/app/(dashboard)/components/ui/PageShell";
import ErrorBanner from "@/app/(dashboard)/components/ui/ErrorBanner";
import DatasetDetailHeader from "@/app/(dashboard)/components/datasets/DatasetDetailHeader";
import DatasetInfoTable from "@/app/(dashboard)/components/datasets/DatasetInfoTable";
import ChunksList from "@/app/(dashboard)/components/datasets/ChunksList";
import { useDatasetDetail } from "@/app/(dashboard)/hooks/useDatasetDetail";
import { toDataset } from "@/app/(dashboard)/lib/datasets/toDataset";
import { useState } from "react";

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { dataset, chunks, error, isInitialLoading, reindex } = useDatasetDetail(id);
  const [reindexing, setReindexing] = useState(false);

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await reindex();
    } catch (err) {
      console.error("Reindex failed:", err);
    } finally {
      setReindexing(false);
    }
  };

  // Skeleton only on first load — once the dataset exists, keep content mounted
  // (so re-index refetches never blank the page; the button shows inline state).
  if (isInitialLoading && !dataset) {
    return <PageDetailSkeleton />;
  }

  if (error || !dataset) {
    return (
      <PageShell maxWidth={2}>
        <ErrorBanner message={error ?? "Dataset not found"} />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={2}>
      {/* Header */}
      <DatasetDetailHeader
        dataset={dataset}
        reindexing={reindexing}
        onReindex={handleReindex}
      />

      {/* Summary */}
      <div className="mb-8">
        <DatasetCard dataset={toDataset(dataset)} />
      </div>

      {/* Chunks */}
      <ChunksList chunks={chunks} />

      {/* Status */}
      <DatasetInfoTable dataset={dataset} />
    </PageShell>
  );
}
