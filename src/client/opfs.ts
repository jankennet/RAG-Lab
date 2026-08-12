// ── OPFS (Origin Private File System) data layer ──────────
// All data stored locally in the browser.
// Chunking delegates to the shared strategy-pattern chunker.

import { FixedSizeChunker, selectChunker, type DocumentType,} from "@/server/rag/chunker";
import type { ChatScope, ChatThread, DatasetSource } from "@/shared/types";
import { bm25Search,} from "@/shared/bm25";

export type OpfsDataset = {
  id: string;
  name: string;
  source: DatasetSource;
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
const CHATS_DIR = "rag-chats";
const CHATS_INDEX = "chats-index.json";

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

// ── Chat thread storage ─────────────────────────────────────────

async function chatsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await rootDir();
  return ensureDir(root, CHATS_DIR);
}

async function loadChatIds(): Promise<string[]> {
  try {
    const dir = await chatsDir();
    const handle = await readFileHandle(dir, CHATS_INDEX);
    if (!handle) return [];
    return (await readJson(handle)) as string[];
  } catch {
    return [];
  }
}

async function saveChatIds(ids: string[]): Promise<void> {
  const dir = await chatsDir();
  let handle = await readFileHandle(dir, CHATS_INDEX);
  if (!handle) {
    handle = await dir.getFileHandle(CHATS_INDEX, { create: true });
  }
  await writeJson(handle, ids);
}

function defaultChatThread(id: string, title = "New chat"): ChatThread {
  return {
    id,
    title,
    scope: "chat",
    datasetId: null,
    attachments: [],
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function normalizeChatThread(thread: Partial<ChatThread> & { id: string }): ChatThread {
  return {
    ...defaultChatThread(thread.id, thread.title ?? "New chat"),
    ...thread,
    scope: thread.scope ?? "chat",
    datasetId: thread.datasetId ?? null,
    attachments: thread.attachments ?? [],
    messages: thread.messages ?? [],
    createdAt: thread.createdAt ?? Date.now(),
    updatedAt: thread.updatedAt ?? Date.now(),
  };
}

export async function createChatThread(meta?: {
  title?: string;
  scope?: ChatScope;
  datasetId?: string | null;
}): Promise<ChatThread> {
  const id = uuid();
  const thread = normalizeChatThread({
    id,
    title: meta?.title ?? "New chat",
    scope: meta?.scope ?? "chat",
    datasetId: meta?.datasetId ?? null,
    attachments: [],
    messages: [],
  });
  await saveChatThread(thread);
  return thread;
}

export async function saveChatThread(thread: ChatThread): Promise<void> {
  const dir = await chatsDir();
  const handle = await dir.getFileHandle(`${thread.id}.json`, { create: true });
  const normalized = normalizeChatThread(thread);
  await writeJson(handle, normalized);

  const ids = await loadChatIds();
  if (!ids.includes(thread.id)) {
    ids.unshift(thread.id);
    await saveChatIds(ids);
  }
}

export async function loadChatThread(id: string): Promise<ChatThread | null> {
  try {
    const dir = await chatsDir();
    const handle = await readFileHandle(dir, `${id}.json`);
    if (!handle) return null;
    return normalizeChatThread((await readJson(handle)) as Partial<ChatThread> & { id: string });
  } catch {
    return null;
  }
}

export async function loadChatThreads(): Promise<ChatThread[]> {
  try {
    const ids = await loadChatIds();
    const threads: ChatThread[] = [];
    for (const id of ids) {
      const thread = await loadChatThread(id);
      if (thread) threads.push(thread);
    }
    return threads.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteChatThread(id: string): Promise<void> {
  try {
    const dir = await chatsDir();
    await dir.removeEntry(`${id}.json`);
  } catch {
    // Ignore missing files.
  }

  const ids = await loadChatIds();
  const next = ids.filter((existing) => existing !== id);
  await saveChatIds(next);
}

export function summarizeChatTitle(message: string): string {
  const cleaned = message.trim().replace(/\s+/g, " ");
  if (!cleaned) return "New chat";
  if (cleaned.length <= 48) return cleaned;
  return `${cleaned.slice(0, 45).trimEnd()}…`;
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

  // Compute row count: strip trailing ":<index>" segment from sourceKey
  // e.g. "name:chunk:0" → "name:chunk"  or  "dataset:row1:2" → "dataset:row1"
  const rowKeys = documents.map((d) => {
    const lastColon = d.sourceKey.lastIndexOf(":");
    return lastColon > 0 ? d.sourceKey.slice(0, lastColon) : d.sourceKey;
  });
  const uniqueRows = new Set(rowKeys);

  const metaHandle = await readFileHandle(dsDir, "meta.json");
  if (metaHandle) {
    const meta = (await readJson(metaHandle)) as OpfsDataset;
    meta.chunkCount = documents.length;
    meta.rowCount = uniqueRows.size;
    await writeJson(metaHandle, meta);
  }

  const index = await loadIndex();
  const idx = index.findIndex((d) => d.id === id);
  if (idx >= 0) {
    index[idx].chunkCount = documents.length;
    index[idx].rowCount = uniqueRows.size;
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

export async function deleteAllChats(): Promise<void> {
  const root = await rootDir();
  try {
    await root.removeEntry(CHATS_DIR, { recursive: true });
  } catch {
    // Directory may not exist — nothing to delete
  }
}

export async function deleteAllBenchmarks(): Promise<void> {
  const root = await rootDir();
  try {
    await root.removeEntry(BENCHMARKS_DIR, { recursive: true });
  } catch {
    // Directory may not exist — nothing to delete
  }
}

// ── Chunking (delegates to shared strategy-pattern chunker) ──

/**
 * Legacy backward-compat: fixed-size chunk.
 * Delegates to FixedSizeChunker from the shared module.
 *
 * @deprecated Prefer `smartChunkText`, which auto-detects structured (JSON) vs
 * unstructured (prose) content — fixed-size chunking silently mangles JSON rows.
 * Kept only for callers that intentionally want a fixed-size cut.
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

/**
 * Re-chunk an existing dataset: join every document's content, re-split with
 * `smartChunkText` at the default 1000/150 size, and persist back. Lifted from
 * the inline `handleReindex` in datasets/[id]/page.tsx so other callers (batch
 * reindex, settings) can reuse it. Uses smartChunkText (auto-detects JSON vs
 * prose) rather than the legacy fixed-size `chunkText` the page used before.
 */
export async function reindexDataset(id: string): Promise<OpfsDocument[]> {
  const docs = await loadDocuments(id);
  const allContent = docs.map((d) => d.content).join("\n\n");
  const newChunks = smartChunkText(allContent, { chunkSize: 1000, chunkOverlap: 150 });

  // Preserve the dataset name for the regenerate sourceKey/title scheme.
  const index = await loadIndex();
  const ds = index.find((d) => d.id === id);
  const name = ds?.name ?? id;

  const newDocs = makeDocuments(name, null, name, newChunks, { reindexed: true });
  await updateDatasetChunks(id, newDocs);
  return newDocs;
}

// ── Benchmark Storage ─────────────────────────────────────────

// Re-export types used across the app
export type BenchmarkMetrics = {
  latencyMs: number;
  faithfulness: number;
  answerRelevance: number;
  tokenF1: number;
  exactMatch?: number;
  recallAtK?: number;
  precisionAtK?: number;
  mrr?: number;
  labeledCount?: number;
  /** Legacy field — no longer produced by the benchmark route; kept for old runs. */
  contextUtilization?: number;
};

export type CompactQuestionResult = {
  latencyMs: number;
  faithfulness: number;
  answerRelevance: number;
  tokenF1: number;
  exactMatch?: number;
  recallAtK?: number;
  precisionAtK?: number;
  question: string;
  groundTruth: string;
  generatedAnswer: string;
  generationError?: string;
  answerStatus?: "answered" | "refused" | "empty";
  retrievalCount: number;
  retrievedDocTitles: string[];
  /** Legacy field — no longer produced by the benchmark route; kept for old runs. */
  contextUtilization?: number;
};

export type BenchmarkRun = {
  id: string;
  datasetId: string;
  datasetName: string;
  provider: string;
  model: string;
  totalQuestions: number;
  answeredCount: number;
  refusedCount: number;
  emptyCount: number;
  errorCount: number;
  status: string;
  createdAt: number;
  metrics: BenchmarkMetrics;
  details: CompactQuestionResult[];
};

const BENCHMARKS_DIR = "rag-benchmarks";
const BENCHMARKS_INDEX = "benchmarks-index.json";

async function benchmarksDir(): Promise<FileSystemDirectoryHandle> {
  const root = await rootDir();
  return ensureDir(root, BENCHMARKS_DIR);
}

async function loadBenchmarksIndex(): Promise<string[]> {
  try {
    const dir = await benchmarksDir();
    const handle = await readFileHandle(dir, BENCHMARKS_INDEX);
    if (!handle) return [];
    return (await readJson(handle)) as string[];
  } catch {
    return [];
  }
}

async function saveBenchmarksIndex(ids: string[]): Promise<void> {
  const dir = await benchmarksDir();
  let handle = await readFileHandle(dir, BENCHMARKS_INDEX);
  if (!handle) {
    handle = await dir.getFileHandle(BENCHMARKS_INDEX, { create: true });
  }
  await writeJson(handle, ids);
}

export async function saveBenchmarkRun(run: BenchmarkRun): Promise<void> {
  const dir = await benchmarksDir();
  const fileHandle = await dir.getFileHandle(`${run.id}.json`, { create: true });
  await writeJson(fileHandle, run);

  const index = await loadBenchmarksIndex();
  if (!index.includes(run.id)) {
    index.unshift(run.id);
    // Cap at 100
    while (index.length > 100) {
      const old = index.pop()!;
      try { await dir.removeEntry(`${old}.json`); } catch { /* ignore */ }
    }
    await saveBenchmarksIndex(index);
  }
}

export async function loadBenchmarkRuns(): Promise<BenchmarkRun[]> {
  const dir = await benchmarksDir();
  const ids = await loadBenchmarksIndex();
  const runs: BenchmarkRun[] = [];
  for (const id of ids) {
    try {
      const handle = await readFileHandle(dir, `${id}.json`);
      if (handle) {
        const data = (await readJson(handle)) as BenchmarkRun;
        runs.push(data);
      }
    } catch { /* skip corrupt */ }
  }
  return runs;
}

export async function loadBenchmarkRun(id: string): Promise<BenchmarkRun | null> {
  try {
    const dir = await benchmarksDir();
    const handle = await readFileHandle(dir, `${id}.json`);
    if (!handle) return null;
    return (await readJson(handle)) as BenchmarkRun;
  } catch {
    return null;
  }
}

// ── Keyword Search ─────────────────────────────────────────────

export async function searchDocuments(
  _datasetId: string | null,
  query: string,
  topK = 4,
): Promise<OpfsDocument[]> {
  const index = await loadIndex();
  const targets = _datasetId
    ? index.filter((d) => d.id === _datasetId)
    : index;

  const allDocs: OpfsDocument[] = [];
  for (const ds of targets) {
    const docs = await loadDocuments(ds.id);
    allDocs.push(...docs);
  }

  // Create a lookup map of original OpfsDocuments by sourceKey
  const docMap = new Map(allDocs.map((doc) => [doc.sourceKey, doc]));

  // OpfsDocument natively satisfies SearchableDoc
  const results = bm25Search(allDocs, query, { topK });

  // Retrieve original full OpfsDocument objects
  return results
    .map((res) => docMap.get(res.sourceKey))
    .filter((doc): doc is OpfsDocument => doc !== undefined);
}