/** URL pattern → source type + metadata. */

export type SourceInfo = {
  source: string;
  name: string;
  meta: Record<string, string>;
};

const HF_RE = /huggingface\.co\/datasets\/([^/]+(?:\/[^/]+)?)/;
const KAGGLE_RE = /kaggle\.com\/datasets\/([^/]+\/[^/?#]+)/;
const UCI_RE = /archive\.ics\.uci\.edu/;
const WORLDBANK_RE = /worldbank\.org/;

const EXT_MAP: Record<string, string> = {
  ".csv": "csv",
  ".json": "json",
  ".jsonl": "jsonl",
  ".txt": "text",
  ".md": "text",
  ".html": "html",
  ".htm": "html",
  ".xml": "text",
  ".docx": "docx",
  ".xlsx": "xlsx",
  ".xls": "xls",
  ".sql": "sql",
  ".pdf": "pdf",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".tiff": "image",
  ".tif": "image",
  ".bmp": "image",
  ".webp": "image",
};

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

  // URL path extension detection
  try {
    const pathExt = new URL(url).pathname.toLowerCase();
    for (const [ext, source] of Object.entries(EXT_MAP)) {
      if (pathExt.endsWith(ext)) return { source, name: basename(url, ext), meta: {} };
    }
  } catch {
    // invalid URL
  }

  return { source: "raw", name: basename(url, ""), meta: {} };
}

function basename(url: string, ext: string): string {
  try {
    const path = new URL(url).pathname;
    const name = path.split("/").filter(Boolean).pop() || "dataset";
    return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
  } catch {
    return "dataset";
  }
}

/** Detect file type from local path extension. */
export function detectFileType(filePath: string): string {
  const lower = filePath.toLowerCase();
  for (const [ext, type] of Object.entries(EXT_MAP)) {
    if (lower.endsWith(ext)) return type;
  }
  // Try to detect by reading first bytes
  return "binary";
}

/** Binary extensions that need special handling (not plain text). */
export const BINARY_EXTS = new Set([
  ".docx", ".xlsx", ".xls",
  ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp",
]);