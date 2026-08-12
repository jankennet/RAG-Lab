// Run-benchmark form: KB dataset + question set selects, question limit, model
// selector, error line, submit button, and the live progress bar while running.
// Lifted from benchmarks/page.tsx L347-446 (form) + L428-445 (bar). State lives in
// `useBenchmarkRunner`; this leaf renders it. The disabled-when rule matches the
// page: disabled while `triggering` OR no dataset/question set selected. Max
// question limit is pinned to the shared constant.

"use client";

import type { FormEvent } from "react";
import type { OpfsDataset } from "@/client/opfs";
import type { BenchmarkQuestionSet } from "@/client/benchmark-questions";
import ModelSelector from "../ModelSelector";
import BenchmarkProgressBar from "./BenchmarkProgressBar";
import { MAX_QUESTION_LIMIT } from "@/app/(dashboard)/lib/benchmark/benchmarks.constants";

type BenchmarkRunnerFormState = {
  datasetId: string;
  setDatasetId: (v: string) => void;
  questionSetId: string;
  setQuestionSetId: (v: string) => void;
  limit: number;
  setLimit: (v: number) => void;
  benchProvider: Parameters<typeof ModelSelector>[0]["provider"];
  setBenchProvider: Parameters<typeof ModelSelector>[0]["onProviderChange"];
  benchModel: string;
  setBenchModel: Parameters<typeof ModelSelector>[0]["onModelChange"];
  triggering: boolean;
  triggerError: string | null;
  progress: number;
  trigger: (e?: FormEvent) => void;
};

type BenchmarkRunFormProps = {
  form: BenchmarkRunnerFormState;
  datasets: OpfsDataset[];
  questionSets: BenchmarkQuestionSet[];
};

export default function BenchmarkRunForm({ form, datasets, questionSets }: BenchmarkRunFormProps) {
  const handleSubmit = (e: FormEvent) => {
    void form.trigger(e);
  };

  return (
    <div className="bg-bg-alt rounded-2xl border border-line p-6 mb-8">
      <h2 className="font-semibold mb-2">Run Benchmark</h2>
      <p className="text-sm text-muted mb-6">
        Select a Knowledge Base dataset + a Question Set with ground truth answers.
        Scores: faithfulness, relevance, context utilization (LLM-judged),
        token F1 (answer vs ground truth), and latency.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">
              Knowledge Base Dataset
            </label>
            <select
              value={form.datasetId}
              onChange={(e) => form.setDatasetId(e.target.value)}
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
              value={form.questionSetId}
              onChange={(e) => form.setQuestionSetId(e.target.value)}
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
            value={form.limit}
            onChange={(e) => form.setLimit(Number(e.target.value))}
            min={1}
            max={MAX_QUESTION_LIMIT}
            className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-muted">Model</label>
          <ModelSelector
            provider={form.benchProvider}
            model={form.benchModel}
            onProviderChange={form.setBenchProvider}
            onModelChange={form.setBenchModel}
          />
        </div>
        {form.triggerError && (
          <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {form.triggerError}
          </p>
        )}
        <button
          type="submit"
          disabled={form.triggering || !form.datasetId || !form.questionSetId}
          className="w-full px-4 py-2.5 bg-accent text-[#03111a] font-semibold rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {form.triggering ? "Running..." : "Run Benchmark"}
        </button>
      </form>

      {form.triggering && (
        <BenchmarkProgressBar
          progress={form.progress}
          limit={form.limit}
          provider={form.benchProvider}
          model={form.benchModel}
        />
      )}
    </div>
  );
}
