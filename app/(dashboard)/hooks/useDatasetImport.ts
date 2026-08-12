// Shared HuggingFace benchmark-question-set import. Owns the import-form state
// (name, dataset id, config, split, max-rows, optional question/answer fields)
// and the POST → createQuestionSet → saveQuestions pipeline. Lifted verbatim
// from the identical handlers in benchmarks/page.tsx (L88-140) and
// benchmark-datasets/page.tsx (L43-93) — they hit the same
// `/api/benchmark-datasets` endpoint and persist identically, so this is the
// one shared hook both pages compose (Phase 4 benchmarks page; Phase 5
// `useHfImport` wraps it for the benchmark-datasets page).
//
// The "Cancel" toggle (`showImport`) is exposed so the page can drive its own
// header button without re-owning the import state.

"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import {
  createQuestionSet,
  saveQuestions,
} from "@/client/benchmark-questions";
import type { BenchmarkQuestion } from "@/client/benchmark-questions";
import { MAX_IMPORT_ROWS, MIN_IMPORT_ROWS, DEFAULT_IMPORT_MAX_ROWS } from "@/app/(dashboard)/lib/benchmark/benchmarks.constants";

export type DatasetImportForm = ReturnType<typeof useDatasetImport>;

export function useDatasetImport(options?: {
  /** Fires after a successful import + form reset, so the page can refetch. */
  onImported?: () => void;
}) {
  const onImportedRef = useRef(options?.onImported);
  onImportedRef.current = options?.onImported;

  const [showImport, setShowImport] = useState(false);
  const [importName, setImportName] = useState("");
  const [importDatasetId, setImportDatasetId] = useState("");
  const [importConfig, setImportConfig] = useState("default");
  const [importSplit, setImportSplit] = useState("train");
  const [importMaxRows, setImportMaxRows] = useState(DEFAULT_IMPORT_MAX_ROWS);
  const [importQuestionField, setImportQuestionField] = useState("");
  const [importAnswerField, setImportAnswerField] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const toggleImport = useCallback(() => setShowImport((v) => !v), []);

  const reset = useCallback(() => {
    setShowImport(false);
    setImportName("");
    setImportDatasetId("");
  }, []);

  const importQuestions = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
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
        reset();
        onImportedRef.current?.();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Failed to import");
      } finally {
        setImporting(false);
      }
    },
    [importName, importDatasetId, importConfig, importSplit, importMaxRows, importQuestionField, importAnswerField, reset],
  );

  return {
    // toggle / visibility
    showImport, toggleImport,
    // form state
    importName, setImportName,
    importDatasetId, setImportDatasetId,
    importConfig, setImportConfig,
    importSplit, setImportSplit,
    importMaxRows, setImportMaxRows,
    importQuestionField, setImportQuestionField,
    importAnswerField, setImportAnswerField,
    // status
    importing, importError,
    // actions
    importQuestions, reset,
    // limits (re-exported for the form's min/max attributes)
    minRows: MIN_IMPORT_ROWS,
    maxRows: MAX_IMPORT_ROWS,
  };
}
