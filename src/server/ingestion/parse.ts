/** Parse raw text into rows based on content type. */

export type FieldHints = {
  title?: string;
  content?: string;
  id?: string;
  url?: string;
};

export type ParseResult = {
  rows: Record<string, unknown>[];
  fieldHints: FieldHints;
};

/** Strip HTML tags, extract readable text. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect common field names for title/content/id/url. */
function detectHints(fields: string[]): FieldHints {
  const lower = fields.map((f) => f.toLowerCase());
  const titleIdx = lower.findIndex((f) => ["title", "name", "question", "headline"].includes(f));
  const contentIdx = lower.findIndex((f) =>
    ["text", "content", "documents", "document", "body", "description", "passage", "context"].includes(f),
  );
  const idIdx = lower.findIndex((f) => ["id", "uuid", "index", "row_id"].includes(f));
  const urlIdx = lower.findIndex((f) => ["url", "link", "source_url", "uri"].includes(f));
  return {
    title: titleIdx >= 0 ? fields[titleIdx] : (fields[0] ?? ""),
    content: contentIdx >= 0 ? fields[contentIdx] : "",
    id: idIdx >= 0 ? fields[idIdx] : "",
    url: urlIdx >= 0 ? fields[urlIdx] : "",
  };
}

function parseJson(raw: string): Record<string, unknown>[] {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && parsed !== null) {
    for (const key of ["data", "rows", "results", "items", "records", "documents"]) {
      const arr = (parsed as Record<string, unknown>)[key];
      if (Array.isArray(arr)) return arr;
    }
    return [parsed];
  }
  return [];
}

function parseJsonl(raw: string): Record<string, unknown>[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Parse CSV. Handles quoted fields with commas. */
function parseCsv(raw: string): Record<string, unknown>[] {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  if (headers.length < 1) return [];
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    if (vals.length === 0 || vals.every((v) => !v.trim())) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      row[h] = vals[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function looksLikeHtml(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<head");
}

export function parseContent(raw: string, contentType: string): ParseResult {
  const ct = contentType.toLowerCase();

  // HTML — strip tags, return as single raw document
  if (ct.includes("html") || looksLikeHtml(raw)) {
    const text = stripHtml(raw);
    // Try to extract a title
    const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "webpage";
    return {
      rows: [{ text, title }],
      fieldHints: { content: "text", title: "title" },
    };
  }

  // JSONL
  if (ct.includes("jsonl") || raw.split("\n").every((l) => l.trim().startsWith("{"))) {
    const rows = parseJsonl(raw);
    const hints = rows.length > 0 ? detectHints(Object.keys(rows[0])) : {};
    return { rows, fieldHints: hints };
  }

  // JSON
  if (ct.includes("json") || raw.trim().startsWith("[")) {
    const rows = parseJson(raw);
    const hints = rows.length > 0 ? detectHints(Object.keys(rows[0])) : {};
    return { rows, fieldHints: hints };
  }

  // CSV: detect by first line containing commas
  const firstLine = raw.split("\n")[0];
  if (ct.includes("csv") || (firstLine && /[^"]*,[^"]*/.test(firstLine))) {
    const rows = parseCsv(raw);
    const hints = rows.length > 0 ? detectHints(Object.keys(rows[0])) : {};
    return { rows, fieldHints: hints };
  }

  // Raw text fallback
  return {
    rows: [{ text: raw, title: "document" }],
    fieldHints: { content: "text", title: "title" },
  };
}