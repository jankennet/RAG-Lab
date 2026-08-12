// HuggingFace ingest fields rendered inside the Add Dataset form: dataset ID,
// auto-fetched subset + split selects, and max-rows. Pure presentational slice
// over the `useDatasetAddForm` HF state — no fetching logic here (that lives in
// the hook). Lifted verbatim from datasets/page.tsx L391-466.

type HfDatasetFieldsProps = {
  hfDatasetId: string;
  onHfDatasetIdChange: (value: string) => void;
  hfConfig: string;
  onHfConfigChange: (value: string) => void;
  hfConfigs: string[];
  hfConfigsLoading: boolean;
  hfSplit: string;
  onHfSplitChange: (value: string) => void;
  hfSplits: Array<{ config: string; split: string }>;
  hfSplitsLoading: boolean;
  hfMaxRows: string;
  onHfMaxRowsChange: (value: string) => void;
};

export default function HfDatasetFields({
  hfDatasetId,
  onHfDatasetIdChange,
  hfConfig,
  onHfConfigChange,
  hfConfigs,
  hfConfigsLoading,
  hfSplit,
  onHfSplitChange,
  hfSplits,
  hfSplitsLoading,
  hfMaxRows,
  onHfMaxRowsChange,
}: HfDatasetFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-muted mb-1.5">Dataset ID</label>
        <input
          type="text"
          value={hfDatasetId}
          onChange={(e) => onHfDatasetIdChange(e.target.value)}
          required
          className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
          placeholder="e.g., galileo-ai/ragbench"
        />
        <p className="mt-2 text-xs text-muted">
          HF ingest keeps only documents/context fields. Answer, model, score, and eval columns are skipped.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Subset</label>
          {hfConfigs.length > 0 ? (
            <select
              value={hfConfig}
              onChange={(e) => onHfConfigChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
            >
              {hfConfigs.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={hfConfig}
              onChange={(e) => onHfConfigChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
              placeholder={hfConfigsLoading ? "Loading subsets..." : "default"}
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Split</label>
          {hfSplits.length > 0 ? (
            <select
              value={hfSplit}
              onChange={(e) => onHfSplitChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
            >
              {hfSplits.map((s) => (
                <option key={s.split} value={s.split}>{s.split}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={hfSplit}
              onChange={(e) => onHfSplitChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
              placeholder={hfSplitsLoading ? "Loading splits..." : "train"}
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Max Rows</label>
          <input
            type="number"
            value={hfMaxRows}
            onChange={(e) => onHfMaxRowsChange(e.target.value)}
            min={1}
            max={100000}
            className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
