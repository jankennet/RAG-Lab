// ── OPFS storage for benchmark question sets ──────────
// Questions with ground truth, separate from knowledge base datasets.
// Stored client-side in the browser (OPFS).

export type BenchmarkQuestion = {
  id: string;
  question: string;
  groundTruth: string;
  category?: string;
  difficulty?: string;
  expectedSources?: string[];
  metadata?: Record<string, unknown>;
};

export type BenchmarkQuestionSet = {
  id: string;
  name: string;
  source: "huggingface" | "manual" | "generated";
  sourceUrl: string | null;
  questionCount: number;
  createdAt: number;
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

// ── Storage dirs ─────────────────────────────────────────────

const PARENT_DIR = "rag-benchmark-questions";
const INDEX_FILE = "index.json";

async function parentDir(): Promise<FileSystemDirectoryHandle> {
  const root = await rootDir();
  return ensureDir(root, PARENT_DIR);
}

async function loadIndex(): Promise<string[]> {
  try {
    const dir = await parentDir();
    const handle = await readFileHandle(dir, INDEX_FILE);
    if (!handle) return [];
    return (await readJson(handle)) as string[];
  } catch {
    return [];
  }
}

async function saveIndex(ids: string[]): Promise<void> {
  const dir = await parentDir();
  let handle = await readFileHandle(dir, INDEX_FILE);
  if (!handle) {
    handle = await dir.getFileHandle(INDEX_FILE, { create: true });
  }
  await writeJson(handle, ids);
}

// ── CRUD ────────────────────────────────────────────────────

export async function createQuestionSet(meta: {
  name: string;
  source: BenchmarkQuestionSet["source"];
  sourceUrl?: string | null;
}): Promise<BenchmarkQuestionSet> {
  const set: BenchmarkQuestionSet = {
    id: uuid(),
    name: meta.name,
    source: meta.source,
    sourceUrl: meta.sourceUrl ?? null,
    questionCount: 0,
    createdAt: Date.now(),
  };

  const dir = await parentDir();
  const setDir = await ensureDir(dir, `set_${set.id}`);

  const metaHandle = await setDir.getFileHandle("meta.json", { create: true });
  await writeJson(metaHandle, set);

  const qsHandle = await setDir.getFileHandle("questions.json", { create: true });
  await writeJson(qsHandle, []);

  const index = await loadIndex();
  index.unshift(set.id);
  await saveIndex(index);

  return set;
}

export async function saveQuestions(setId: string, questions: BenchmarkQuestion[]): Promise<void> {
  const dir = await parentDir();
  const setDir = await ensureDir(dir, `set_${setId}`);

  const qsHandle = await setDir.getFileHandle("questions.json", { create: true });
  await writeJson(qsHandle, questions);

  // Update meta
  const metaHandle = await readFileHandle(setDir, "meta.json");
  if (metaHandle) {
    const meta = (await readJson(metaHandle)) as BenchmarkQuestionSet;
    meta.questionCount = questions.length;
    await writeJson(metaHandle, meta);
  }

  // Update index
  const index = await loadIndex();
  const idx = index.indexOf(setId);
  if (idx < 0) {
    index.unshift(setId);
    await saveIndex(index);
  }
}

export async function loadQuestionSets(): Promise<BenchmarkQuestionSet[]> {
  const ids = await loadIndex();
  const dir = await parentDir();
  const sets: BenchmarkQuestionSet[] = [];

  for (const id of ids) {
    try {
      const setDir = await ensureDir(dir, `set_${id}`);
      const metaHandle = await readFileHandle(setDir, "meta.json");
      if (metaHandle) {
        sets.push((await readJson(metaHandle)) as BenchmarkQuestionSet);
      }
    } catch {
      // skip corrupt
    }
  }

  return sets;
}

export async function loadQuestionSetMeta(id: string): Promise<BenchmarkQuestionSet | null> {
  try {
    const dir = await parentDir();
    const setDir = await ensureDir(dir, `set_${id}`);
    const handle = await readFileHandle(setDir, "meta.json");
    if (!handle) return null;
    return (await readJson(handle)) as BenchmarkQuestionSet;
  } catch {
    return null;
  }
}

export async function loadQuestions(id: string): Promise<BenchmarkQuestion[]> {
  try {
    const dir = await parentDir();
    const setDir = await ensureDir(dir, `set_${id}`);
    const handle = await readFileHandle(setDir, "questions.json");
    if (!handle) return [];
    return (await readJson(handle)) as BenchmarkQuestion[];
  } catch {
    return [];
  }
}

export async function deleteQuestionSet(id: string): Promise<void> {
  const dir = await parentDir();
  try {
    await dir.removeEntry(`set_${id}`, { recursive: true });
  } catch {
    // may not exist
  }

  const index = await loadIndex();
  await saveIndex(index.filter((i) => i !== id));
}

export async function deleteAllQuestionSets(): Promise<void> {
  const root = await rootDir();
  try {
    await root.removeEntry(PARENT_DIR, { recursive: true });
  } catch {
    // Directory may not exist — nothing to delete
  }
}