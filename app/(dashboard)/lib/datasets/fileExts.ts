// File-extension classification shared by the datasets uploader and the chat
// attachment flow. Previously these sets were rebuilt inside each handler
// (datasets/page.tsx + components/ChatView.tsx), overlapping and inconsistent.

/** Text-parseable attachments: read locally with `file.text()`, no server roundtrip. */
export const TEXT_EXTS = new Set([
  ".txt", ".md", ".text", ".rst", ".html", ".htm", ".xml", ".csv", ".json", ".jsonl", ".sql",
]);

/** Files that may require OCR (PDF / images). Same as datasets `OCR_EXTS` and chat `OCR_HINT_EXTS`. */
export const OCR_EXTS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp",
]);

/** Chat upload hint set for OCR-capable files, kept aligned with the dataset parser. */
export const OCR_HINT_EXTS = new Set(OCR_EXTS);

/** Binary files routed to the upload server (includes Office formats beyond the OCR set). */
export const BINARY_EXTS = new Set([
  ".pdf", ".docx", ".xlsx", ".xls", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp",
]);

/** `accept` attribute for file inputs covering every supported format. */
export const ACCEPT_ATTR =
  ".txt,.md,.json,.csv,.html,.htm,.xml,.log,.sql,.pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.tiff,.bmp,.webp";

/** Lowercase extension including the dot, e.g. "report.PDF" → ".pdf". */
export function fileExt(name: string): string {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}
