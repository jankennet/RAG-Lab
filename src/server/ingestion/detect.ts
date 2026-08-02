/** File type detection from extension. */

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

/** Detect file type from local path extension. */
export function detectFileType(filePath: string): string {
  const lower = filePath.toLowerCase();
  for (const [ext, type] of Object.entries(EXT_MAP)) {
    if (lower.endsWith(ext)) return type;
  }
  return "binary";
}

/** Binary extensions that need special handling (not plain text). */
export const BINARY_EXTS = new Set([
  ".docx", ".xlsx", ".xls",
  ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp",
]);