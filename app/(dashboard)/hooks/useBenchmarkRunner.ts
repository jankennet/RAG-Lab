// Benchmark runner: run-form state (dataset, question set, limit, provider,
// model) + the trigger that POSTs /api/benchmarks, parses the NDJSON progress
// stream, saves the run to OPFS, and refetches.
//
// The NDJSON parser (the for-loop over reader.read() + line-split buffer) is
// copied VERBATIM from benchmarks/page.tsx L188-211. It is fragile (partial-line
// handling, bare JSON.parse that throws on a malformed line and aborts the run)
// and refactoring it mid-stream risks the progress-bar / saved-run parity the
// manual gate checks (R2). Don't "improve" it — the manual gate watches the
// progress bar advance and the saved run JSON match the Phase-0 baseline.
//
// Behavior preserved from the page:
//   - dataset name lookup for the POST body (`datasets.find(...) ?? "Unknown"`)
//   - questions sliced to `limit`
//   - the non-ok / no-body error-text → JSON.parse → text fallback verbatim
//   - final `saveBenchmarkRun(run)` + refetch + progress set to 1
// The dead `qSet` local the page computed but never used is dropped (no behavior
// change — it wasn't read).

"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import type { LlmProvider } from "@/shared/types";
import {
  loadDocuments,
  saveBenchmarkRun,
} from "@/client/opfs";
import type { BenchmarkRun, OpfsDataset } from "@/client/opfs";
import { loadQuestions } from "@/client/benchmark-questions";
import { DEFAULT_QUESTION_LIMIT } from "@/app/(dashboard)/lib/benchmark/benchmarks.constants";

type UseBenchmarkRunnerOptions = {
  /** KB datasets — used for the dataset-name lookup in the run POST body. */
  datasets: OpfsDataset[];
  /** Called after a run is saved, so the page can refetch its list. */
  onRunComplete?: () => void;
  initialProvider: LlmProvider;
  initialModel: string;
};

export function useBenchmarkRunner({
  datasets,
  onRunComplete,
  initialProvider,
  initialModel,
}: UseBenchmarkRunnerOptions) {
  // Stable ref so the callback doesn't re-stabilize every render.
  const onCompleteRef = useRef(onRunComplete);
  onCompleteRef.current = onRunComplete;

  const [datasetId, setDatasetId] = useState("");
  const [questionSetId, setQuestionSetId] = useState("");
  const [limit, setLimit] = useState(DEFAULT_QUESTION_LIMIT);
  const [benchProvider, setBenchProvider] = useState<LlmProvider>(initialProvider);
  const [benchModel, setBenchModel] = useState(initialModel);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const trigger = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      if (!datasetId || !questionSetId) return;

      setTriggering(true);
      setTriggerError(null);
      try {
        const dataset = datasets.find((d) => d.id === datasetId);
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
              relevantDocIds: q.expectedSources,
            })),
            documents: docs,
            provider: benchProvider,
            model: benchModel,
          }),
        });

        // NDJSON stream — parse line-by-line for real progress + the final run.
        if (!res.ok || !res.body) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            throw new Error(typeof data.error === "string" ? data.error : text);
          } catch {
            throw new Error(text || `HTTP ${res.status}`);
          }
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let run: BenchmarkRun | null = null;

        for (;;) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const msg = JSON.parse(line);
            if (msg.type === "progress") {
              setProgress(msg.total > 0 ? msg.done / msg.total : 1);
            } else if (msg.type === "run") {
              run = msg.run;
            } else if (msg.type === "error") {
              throw new Error(msg.error ?? "Benchmark failed");
            }
          }
          if (done) break;
        }

        if (!run) throw new Error("Benchmark returned no result");

        // Save to OPFS
        await saveBenchmarkRun(run);

        onCompleteRef.current?.();
        setProgress(1);
      } catch (err) {
        setTriggerError(err instanceof Error ? err.message : "Failed to run benchmark");
      } finally {
        setTriggering(false);
      }
    },
    [datasetId, questionSetId, limit, benchProvider, benchModel, datasets],
  );

  return {
    // form
    datasetId, setDatasetId,
    questionSetId, setQuestionSetId,
    limit, setLimit,
    benchProvider, setBenchProvider,
    benchModel, setBenchModel,
    // status
    triggering, triggerError, progress,
    trigger,
  };
}
