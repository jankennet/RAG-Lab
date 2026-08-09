/**
 * RagBench dataset loader — deterministic, no LLM.
 *
 * RagBench is NOT a shared-corpus benchmark. Each row carries its own evidence:
 *   question      — the query
 *   response      — the reference answer
 *   documents     — list of [Title, Text] pairs that support the answer
 *   dataset_name  — source domain (covidqa_train, pubhealth, ...)
 *
 * The dataset has no "default" config — it splits into per-domain configs
 * (covidqa, pubmedqa, expertqa, ...). So the correct retrieval corpus for a
 * question set is the union of the `documents` of the rows you test, fetched
 * from the configs those rows live in. Querying config="default" 404s, and any
 * single config's corpus silently omits other domains' evidence — which is
 * exactly why the old benchmark surfaced unrelated docs for every question.
 *
 * This loader guarantees coverage: the corpus it returns contains, for every
 * test question, that question's own evidence documents (tracked via
 * relevantDocKeys for retrieval evaluation).
 */
import { downloadHfRows } from "@/server/ingestion/download";

export type SearchableCorpusDoc = {
  title: string;
  content: string;
  sourceKey: string;
};

export type RagbenchQuestion = {
  id: string;
  question: string;
  reference: string;
  /** Corpus sourceKeys of this row's evidence docs (retrieval relevance labels). */
  relevantDocKeys: string[];
};

export type RagbenchData = {
  corpus: SearchableCorpusDoc[];
  questions: RagbenchQuestion[];
};

const DATASET = "galileo-ai/ragbench";

/** Normalize a doc title entry: entries arrive like "Title: <name>". */
function cleanDocTitle(s: string): string {
  return s.replace(/^title:\s*/i, "").trim();
}

/**
 * Extract the [title, text] evidence pairs from a row's `documents` field.
 * Columns vary across configs: some emit a flat string, some a list of
 * [title, text] pairs, some a list of {title, text} objects.
 */
function extractDocs(
  documents: unknown,
  rowIndex: number,
  config: string,
): { docs: SearchableCorpusDoc[]; keys: string[] } {
  const docs: SearchableCorpusDoc[] = [];
  const keys: string[] = [];

  const push = (title: string, text: string, docIdx: number) => {
    const key = `${config}:row-${rowIndex}:doc-${docIdx}`;
    docs.push({ title: cleanDocTitle(title), content: text, sourceKey: key });
    keys.push(key);
  };

  if (documents == null) return { docs, keys };

  if (typeof documents === "string") {
    push("", documents, 0);
    return { docs, keys };
  }

  if (Array.isArray(documents)) {
    let docIdx = 0;
    for (const entry of documents) {
      if (typeof entry === "string") {
        push("", entry, docIdx++);
      } else if (Array.isArray(entry)) {
        const title = String(entry[0] ?? "");
        const text = String(entry[1] ?? entry[0] ?? "");
        push(title, text, docIdx++);
      } else if (typeof entry === "object" && entry !== null) {
        const rec = entry as Record<string, unknown>;
        const title = String(rec.title ?? rec.name ?? "");
        const text = String(rec.text ?? rec.content ?? rec.passage ?? "");
        push(title, text, docIdx++);
      }
    }
    return { docs, keys };
  }

  // Object mapping -> single doc
  if (typeof documents === "object") {
    const rec = documents as Record<string, unknown>;
    const text = String(rec.text ?? rec.content ?? "");
    const title = String(rec.title ?? "");
    push(title, text, 0);
  }
  return { docs, keys };
}

/**
 * Load corpus + question set for one or more ragbench configs.
 *
 * @param configs       comma-separated config names, e.g. "covidqa,pubmedqa,expertqa"
 * @param rowsPerConfig number of train rows to pull per config
 */
export async function loadRagbench(
  configs: string[],
  rowsPerConfig = 25,
): Promise<RagbenchData> {
  const corpus: SearchableCorpusDoc[] = [];
  const questions: RagbenchQuestion[] = [];

  for (const config of configs) {
    const result = await downloadHfRows(DATASET, config, "train", rowsPerConfig);
    const rows = JSON.parse(result.raw) as Record<string, unknown>[];

    rows.forEach((row, i) => {
      const question = String(row.question ?? "").trim();
      const reference = String(row.response ?? row.answer ?? "").trim();
      if (!question || !reference) return;

      const { docs, keys } = extractDocs(row.documents, i, config);
      corpus.push(...docs);
      questions.push({
        id: `${config}:q-${i}`,
        question,
        reference,
        relevantDocKeys: keys,
      });
    });
  }

  return { corpus, questions };
}

/** True coverage ceiling: every test question's evidence is in the corpus. */
export function corpusCoversQuestions(
  data: RagbenchData,
): { covered: number; total: number } {
  const corpusKeys = new Set(data.corpus.map((d) => d.sourceKey));
  let covered = 0;
  for (const q of data.questions) {
    if (q.relevantDocKeys.some((k) => corpusKeys.has(k))) covered++;
  }
  return { covered: covered, total: data.questions.length };
}