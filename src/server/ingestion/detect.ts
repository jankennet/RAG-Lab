/** URL pattern → source type + metadata. */

export type SourceInfo = {
  /** slug for routing: "hf" | "kaggle" | "uci" | "worldbank" | "csv" | "json" | "jsonl" | "raw" */
  source: string;
  /** human-readable dataset name derived from URL */
  name: string;
  /** extra context extracted from URL (HF config/split, Kaggle owner, etc.) */
  meta: Record<string, string>;
};

const HF_RE = /huggingface\.co\/datasets\/([^/]+(?:\/[^/]+)?)/;
const KAGGLE_RE = /kaggle\.com\/datasets\/([^/]+\/[^/?#]+)/;
const UCI_RE = /archive\.ics\.uci\.edu/;
const WORLDBANK_RE = /worldbank\.org/;

export function detectSource(url: string): SourceInfo {
  const hf = url.match(HF_RE);
  if (hf) {
    const name = hf[1];
    return {
      source: "hf",
      name: name.replace(/\//g, "_"),
      meta: { datasetName: name },
    };
  }

  const kaggle = url.match(KAGGLE_RE);
  if (kaggle) {
    return {
      source: "kaggle",
      name: kaggle[1].replace(/\//g, "_"),
      meta: { fullPath: kaggle[1] },
    };
  }

  if (UCI_RE.test(url)) {
    return {
      source: "uci",
      name: new URL(url).pathname.replace(/\/+/g, "_").replace(/^_/, "").replace(/_$/, "") || "uci_dataset",
      meta: {},
    };
  }

  if (WORLDBANK_RE.test(url)) {
    return {
      source: "worldbank",
      name: "worldbank_" + Date.now(),
      meta: {},
    };
  }

  const pathExt = new URL(url).pathname.toLowerCase();
  if (pathExt.endsWith(".csv")) return { source: "csv", name: basename(url, ".csv"), meta: {} };
  if (pathExt.endsWith(".jsonl")) return { source: "jsonl", name: basename(url, ".jsonl"), meta: {} };
  if (pathExt.endsWith(".json")) return { source: "json", name: basename(url, ".json"), meta: {} };

  return { source: "raw", name: basename(url, ""), meta: {} };
}

function basename(url: string, ext: string): string {
  const path = new URL(url).pathname;
  const name = path.split("/").filter(Boolean).pop() || "dataset";
  return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
}