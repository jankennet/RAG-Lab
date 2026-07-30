// ── OPFS (Origin Private File System) data layer ──────────
// All data stored locally in the browser.
// Chunking delegates to the shared strategy-pattern chunker.

import {
  FixedSizeChunker,
  RecursiveChunker,
  StructuredChunker,
  detectDocumentType,
  selectChunker,
  type DocumentType,
} from "@/server/rag/chunker";

export type OpfsDataset = {
  id: string;
  name: string;
  source: "huggingface" | "upload" | "url";
  sourceUrl: string | null;
  rowCount: number;
  chunkCount: number;
  createdAt: number;
};

export type OpfsDocument = {
  id: number;
  sourceKey: string;
  sourceName: string;
  sourceUrl: string | null;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  chunkIndex: number;
};

// ── Helpers ─────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

async function rootDir(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

async function ensureDir(parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true });
}

async function readJson(handle: FileSystemFileHandle): Promise<unknown> {
  const file = await handle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}

async function writeJson(handle: FileSystemFileHandle, data: unknown): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readFileHandle(dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemFileHandle | null> {
  try {
    return await dir.getFileHandle(name);
  } catch {
    return null;
  }
}

// ── Index ───────────────────────────────────────────────────────

const INDEX_FILE = "datasets-index.json";
const DATA_DIR = "rag-data";

async function dataDir(): Promise<FileSystemDirectoryHandle> {
  const root = await rootDir();
  return ensureDir(root, DATA_DIR);
}

export async function loadIndex(): Promise<OpfsDataset[]> {
  try {
    const dir = await dataDir();
    const handle = await readFileHandle(dir, INDEX_FILE);
    if (!handle) return [];
    return (await readJson(handle)) as OpfsDataset[];
  } catch {
    return [];
  }
}

async function saveIndex(datasets: OpfsDataset[]): Promise<void> {
  const dir = await dataDir();
  let handle = await readFileHandle(dir, INDEX_FILE);
  if (!handle) {
    handle = await dir.getFileHandle(INDEX_FILE, { create: true });
  }
  await writeJson(handle, datasets);
}

// ── Datasets CRUD ──────────────────────────────────────────────

export async function createDataset(meta: {
  name: string;
  source: OpfsDataset["source"];
  sourceUrl?: string | null;
}): Promise<OpfsDataset> {
  const dataset: OpfsDataset = {
    id: uuid(),
    name: meta.name,
    source: meta.source,
    sourceUrl: meta.sourceUrl ?? null,
    rowCount: 0,
    chunkCount: 0,
    createdAt: Date.now(),
  };

  const dir = await dataDir();
  const dsDir = await ensureDir(dir, `dataset_${dataset.id}`);

  const metaHandle = await dsDir.getFileHandle("meta.json", { create: true });
  await writeJson(metaHandle, dataset);

  const docsHandle = await dsDir.getFileHandle("documents.json", { create: true });
  await writeJson(docsHandle, []);

  const index = await loadIndex();
  index.unshift(dataset);
  await saveIndex(index);

  return dataset;
}

export async function updateDatasetChunks(id: string, documents: OpfsDocument[]): Promise<void> {
  const dir = await dataDir();
  const dsDir = await ensureDir(dir, `dataset_${id}`);
  const docsHandle = await dsDir.getFileHandle("documents.json", { create: true });
  await writeJson(docsHandle, documents);

  const metaHandle = await readFileHandle(dsDir, "meta.json");
  if (metaHandle) {
    const meta = (await readJson(metaHandle)) as OpfsDataset;
    meta.chunkCount = documents.length;
    meta.rowCount = documents.length > 0
      ? new Set(documents.map((d) => d.sourceKey.split(":chunk:")[0])).size
      : 0;
    await writeJson(metaHandle, meta);
  }

  const index = await loadIndex();
  const idx = index.findIndex((d) => d.id === id);
  if (idx >= 0) {
    index[idx].chunkCount = documents.length;
    await saveIndex(index);
  }
}

export async function loadDocuments(id: string): Promise<OpfsDocument[]> {
  try {
    const dir = await dataDir();
    const dsDir = await ensureDir(dir, `dataset_${id}`);
    const handle = await readFileHandle(dsDir, "documents.json");
    if (!handle) return [];
    return (await readJson(handle)) as OpfsDocument[];
  } catch {
    return [];
  }
}

export async function deleteDataset(id: string): Promise<void> {
  const dir = await dataDir();
  try {
    await dir.removeEntry(`dataset_${id}`, { recursive: true });
  } catch {
    // Directory may not exist
  }

  const index = await loadIndex();
  await saveIndex(index.filter((d) => d.id !== id));
}

export async function deleteAllDatasets(): Promise<void> {
  const root = await rootDir();
  try {
    await root.removeEntry(DATA_DIR, { recursive: true });
  } catch {
    // Directory may not exist — nothing to delete
  }
}

// ── Chunking (delegates to shared strategy-pattern chunker) ──

/**
 * Legacy backward-compat: fixed-size chunk.
 * Delegates to FixedSizeChunker from the shared module.
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 150): string[] {
  return new FixedSizeChunker().split(text, { chunkSize, chunkOverlap: overlap });
}

/**
 * Create chunked documents using the shared strategy-pattern chunker.
 * Auto-detects structured (JSON) vs unstructured (prose) content.
 */
export function makeDocuments(
  sourceName: string,
  sourceUrl: string | null,
  title: string,
  chunks: string[],
  metadata: Record<string, unknown> = {},
): OpfsDocument[] {
  return chunks.map((chunk, i) => ({
    id: i,
    sourceKey: `${sourceName}:chunk:${i}`,
    sourceName,
    sourceUrl,
    title: `${title} — chunk ${i + 1}`,
    content: chunk,
    metadata: { ...metadata, chunkIndex: i },
    chunkIndex: i,
  }));
}

/**
 * Chunk with auto-detection of content type.
 * Uses RecursiveChunker for prose, StructuredChunker for JSON.
 */
export function smartChunkText(
  text: string,
  options?: { chunkSize?: number; chunkOverlap?: number; documentType?: DocumentType },
): string[] {
  const chunker = selectChunker(options?.documentType, undefined, text);
  return chunker.split(text, {
    chunkSize: options?.chunkSize,
    chunkOverlap: options?.chunkOverlap,
  });
}

// ── Keyword Search ─────────────────────────────────────────────

/**
 * Simple keyword-based search. Tokenizes query and documents,
 * scores by # of matching words (case-insensitive).
 */
export async function searchDocuments(
  _datasetId: string | null,
  query: string,
  topK = 4,
): Promise<OpfsDocument[]> {
  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const index = await loadIndex();
  const targets = _datasetId
    ? index.filter((d) => d.id === _datasetId)
    : index;

  const allDocs: OpfsDocument[] = [];
  for (const ds of targets) {
    const docs = await loadDocuments(ds.id);
    allDocs.push(...docs);
  }

  if (queryTokens.length === 0) {
    return allDocs.slice(0, topK);
  }

  const scored = allDocs.map((doc) => {
    const contentLower = doc.content.toLowerCase();
    const titleLower = (doc.title || "").toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
      const titleCount = countOverlap(titleLower, token);
      score += titleCount * 3;
      score += countOverlap(contentLower, token);
    }
    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map((s) => s.doc);
}

function countOverlap(text: string, token: string): number {
  let count = 0;
  let pos = 0;
  while (pos < text.length) {
    const idx = text.indexOf(token, pos);
    if (idx === -1) break;
    count++;
    pos = idx + token.length;
  }
  return count;
}