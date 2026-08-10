// Shared BM25 retrieval (single source of truth) 

export const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at",
  "by", "for", "with", "about", "against", "between", "into", "through",
  "during", "before", "after", "above", "below", "to", "from", "up", "down",
  "in", "out", "on", "off", "over", "under", "again", "further", "once",
  "here", "there", "all", "any", "both", "each", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "s", "t", "can", "will", "just", "don", "should",
  "now", "is", "am", "are", "was", "were", "be", "been", "being", "have",
  "has", "had", "having", "do", "does", "did", "doing", "would", "could",
  "what", "which", "who", "whom", "this", "that", "these", "those", "i",
  "you", "he", "she", "it", "we", "they", "them", "their", "its", "his",
  "her", "my", "your", "our", "of", "as",
]);

const TOKEN_RE = /[a-z0-9]+/g;

/** Lowercase + alphanumeric tokenization, stopword-filtered, length>1. */
export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(TOKEN_RE) ?? [];
  return matches.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Strip trailing chunk index from sourceKey. Two supported shapes:

export function rowKeyOf(sourceKey: string): string {
  const m = sourceKey.match(/^(.*?:row:\d+(?::doc:\d+)?(?::chunk)?)/);
  if (m) return m[1];
  const noChunkSuffix = sourceKey.replace(/:chunk:\d+$/, "");
  if (noChunkSuffix !== sourceKey) return noChunkSuffix;
  // Generic trailing ":<digits>" — common for arbitrary chunk indices.
  return sourceKey.replace(/:\d+$/, "");
}

const K1 = 1.5;
const B = 0.75;
const TITLE_REPEATS = 3;

export type SearchableDoc = {
  title: string;
  content: string;
  sourceKey: string;
};

export type ScoredDoc = SearchableDoc & { score: number };

export type Bm25Options = {
  topK?: number;
  titleRepeats?: number;
};

/**
 * Single-shot BM25 over an in-memory corpus. Use when the caller already
 * holds the corpus (server benchmark route). The client OPFS layer uses
 * {@link bm25Score} over its OPFS-backed documents for streaming loads.
 */
export function bm25Search(
  documents: SearchableDoc[],
  query: string,
  options: Bm25Options = {},
): ScoredDoc[] {
  const topK = options.topK ?? documents.length;
  const titleRepeats = options.titleRepeats ?? TITLE_REPEATS;

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || documents.length === 0) {
    return documents.slice(0, topK).map((d) => ({ ...d, score: 0 }));
  }

  // Per-doc length and term frequency. Title tokens repeat N times for the
  // "title matches matter more" property, prior to length normalization —
  // the BM25 norm absorbs the extra weight so a long content with one
  // title-rare term still wins by IDF.
  const perDoc = documents.map((doc) => {
    const bodyTokens = tokenize(doc.content);
    const titleTokens = tokenize(doc.title || "");
    const allTokens = [
      ...bodyTokens,
      ...Array(titleRepeats).fill(titleTokens).flat(),
    ];
    const tf = new Map<string, number>();
    for (const t of allTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { doc, tf, length: allTokens.length };
  });

  // Document frequency (presence, not count).
  const df = new Map<string, number>();
  for (const { tf } of perDoc) {
    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const n = perDoc.length;
  const avgLength = perDoc.reduce((s, d) => s + d.length, 0) / n;

  // Classic Okapi IDF, clamped non-negative (Lucene convention).
  const idf = (term: string): number => {
    const d = df.get(term) ?? 0;
    return Math.max(0, Math.log((n - d + 0.5) / (d + 0.5) + 1));
  };

  const scored: ScoredDoc[] = perDoc.map(({ doc, tf, length }) => {
    let score = 0;
    for (const term of queryTokens) {
      const freq = tf.get(term) ?? 0;
      if (freq === 0) continue;
      const norm = (freq * (K1 + 1)) / (freq + K1 * (1 - B + B * (length / avgLength)));
      score += idf(term) * norm;
    }
    return { ...doc, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Row-level dedup. Keep the highest-scoring chunk per source row. We do
  // NOT backfill from the remainder once topK is reached — that would re-add
  // chunks sharing a row we already accepted, defeating the dedup contract.
  // We also keep zero-score docs at the tail (corpus too small to score any
  // token match is a legitimate state for the caller to observe).
  const seenRow = new Set<string>();
  const unique: ScoredDoc[] = [];
  for (const s of scored) {
    const row = rowKeyOf(s.sourceKey);
    if (seenRow.has(row)) continue;
    seenRow.add(row);
    unique.push(s);
    if (unique.length >= topK) break;
  }
  return unique;
}
