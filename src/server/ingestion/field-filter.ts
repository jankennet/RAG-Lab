const ANSWERISH_FIELDS = new Set([
  "response",
  "responses",
  "answer",
  "answers",
  "generated_answer",
  "generation",
  "generated",
  "generation_text",
  "completion",
  "label",
  "labels",
  "target",
  "targets",
  "reference",
  "references",
  "prediction",
  "predictions",
  "output",
  "outputs",
]);

const IRRELEVANT_PATTERNS = [
  /(^|_)(eval|evaluation|metric|metrics|score|scores)(_|$)/i,
  /(^|_)(model|models|annotator|annotators|annotating|generation_model|generated_model)(_|$)/i,
  /(^|_)(pred|prediction|predictions|baseline|candidate|gold|truth)(_|$)/i,
  /(^|_)(accuracy|precision|recall|f1|bleu|rouge|meteor|bertscore|loss|perplexity)(_|$)/i,
];

const PREFERRED_CONTENT_FIELDS = [
  "documents",
  "document",
  "context",
  "text",
  "content",
  "passage",
  "question",
  "query",
  "prompt",
  "instruction",
];

export function isAnswerishField(field: string): boolean {
  return ANSWERISH_FIELDS.has(field.toLowerCase());
}

export function isIrrelevantField(field: string): boolean {
  const lower = field.toLowerCase();
  return IRRELEVANT_PATTERNS.some((pattern) => pattern.test(lower));
}

export function isIgnoredField(field: string): boolean {
  return isAnswerishField(field) || isIrrelevantField(field);
}

export function shouldKeepField(field: string, contentField?: string, titleField?: string): boolean {
  if (field === contentField || field === titleField) return false;
  return !isIgnoredField(field);
}

export function pickContentField(row: Record<string, unknown>, preferred?: string): string {
  if (preferred && row[preferred] != null && !isIgnoredField(preferred)) return preferred;

  const fields = Object.keys(row);
  for (const candidate of PREFERRED_CONTENT_FIELDS) {
    const match = fields.find((field) => field.toLowerCase() === candidate);
    if (match && !isIgnoredField(match)) return match;
  }

  return fields.find((field) => !isIgnoredField(field)) ?? fields[0] ?? "";
}