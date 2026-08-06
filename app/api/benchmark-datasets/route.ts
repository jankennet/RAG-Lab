import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";

export const runtime = "nodejs";

// ── Q&A field detection ──────────────────────────────────

const QA_FIELD_PAIRS: Array<[string[], string[]]> = [
  // Each pair: [question-likely fields], [answer-likely fields]
  [["question", "query", "prompt", "instruction", "input", "user_query", "q"], ["answer", "response", "output", "completion", "reply", "target", "a", "ground_truth"]],
  [["ctx", "context_question"], ["reference", "references", "label", "labels"]],
];

function detectFields(rows: Record<string, unknown>[]): {
  questionField: string;
  answerField: string;
  categoryField?: string;
} | null {
  if (rows.length === 0) return null;

  const keys = Object.keys(rows[0]);
  const lowerKeys = keys.map((k) => k.toLowerCase());

  for (const [qPatterns, aPatterns] of QA_FIELD_PAIRS) {
    const qIdx = lowerKeys.findIndex((lk) => qPatterns.includes(lk));
    const aIdx = lowerKeys.findIndex((lk) => aPatterns.includes(lk));
    if (qIdx >= 0 && aIdx >= 0 && qIdx !== aIdx) {
      const categoryIdx = lowerKeys.findIndex((lk) =>
        ["category", "type", "domain", "topic", "task"].includes(lk),
      );
      return {
        questionField: keys[qIdx],
        answerField: keys[aIdx],
        categoryField: categoryIdx >= 0 ? keys[categoryIdx] : undefined,
      };
    }
  }

  // Fallback: first string field = question, second = answer
  const stringFields = keys.filter((k) => typeof rows[0][k] === "string" && String(rows[0][k]).length > 5);
  if (stringFields.length >= 2) {
    return {
      questionField: stringFields[0],
      answerField: stringFields[1],
    };
  }

  return null;
}

// ── Schema ───────────────────────────────────────────────

const importSchema = z.object({
  name: z.string().min(1).max(256),
  datasetName: z.string().min(1).max(512),
  datasetConfig: z.string().max(128).optional().default("default"),
  datasetSplit: z.string().max(128).optional().default("train"),
  maxRows: z.coerce.number().int().positive().max(5000).default(200),
  questionField: z.string().max(128).optional(),
  answerField: z.string().max(128).optional(),
  categoryField: z.string().max(128).optional(),
});

// ── POST: import benchmark dataset from HuggingFace ──────

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.datasets);
    if (guard) return guard;

    const body = importSchema.parse(await request.json());

    if (!body.datasetName.includes("/")) {
      return NextResponse.json({
        error: `Invalid dataset ID "${body.datasetName}". Use format "org/name" (e.g., "galileo-ai/ragbench").`,
      }, { status: 400 });
    }

    // Download rows from HF
    const { downloadHfRows } = await import("@/server/ingestion/download");
    let result;
    try {
      result = await downloadHfRows(
        body.datasetName,
        body.datasetConfig,
        body.datasetSplit,
        body.maxRows,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("404") || msg.includes("not found")) {
        return NextResponse.json({
          error: `Dataset "${body.datasetName}" not found on HuggingFace.`,
        }, { status: 404 });
      }
      return NextResponse.json({ error: `HF API error: ${msg}` }, { status: 502 });
    }

    const rows = JSON.parse(result.raw) as Record<string, unknown>[];
    if (rows.length === 0) {
      return NextResponse.json({
        error: `No rows from "${body.datasetName}".`,
      }, { status: 502 });
    }

    // Detect or use explicit fields
    const explicit = body.questionField && body.answerField;
    const detected = explicit
      ? { questionField: body.questionField!, answerField: body.answerField!, categoryField: body.categoryField }
      : detectFields(rows);

    if (!detected) {
      return NextResponse.json({
        error: `Cannot determine question/answer fields. Available: ${Object.keys(rows[0]).join(", ")}. Pass questionField & answerField explicitly.`,
        availableFields: Object.keys(rows[0]),
      }, { status: 400 });
    }

    const { questionField, answerField, categoryField } = detected;

    // Parse questions
    const questions = rows
      .map((row, i) => {
        const qRaw = row[questionField];
        const aRaw = row[answerField];
        if (qRaw == null || aRaw == null) return null;

        const question = String(qRaw).trim();
        const groundTruth = String(aRaw).trim();
        if (!question || !groundTruth) return null;

        let category: string | undefined;
        if (categoryField && row[categoryField] != null) {
          category = String(row[categoryField]).trim().slice(0, 64);
        }

        return {
          id: `${i}`,
          question,
          groundTruth,
          category: category || undefined,
          metadata: { sourceRow: i },
        };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null);

    if (questions.length === 0) {
      return NextResponse.json({
        error: `No valid question/answer pairs found in fields "${questionField}"/"${answerField}".`,
        availableFields: Object.keys(rows[0]),
      }, { status: 400 });
    }

    return NextResponse.json({
      name: body.name,
      source: "huggingface",
      sourceUrl: `https://huggingface.co/datasets/${body.datasetName}`,
      questionField,
      answerField,
      categoryField,
      totalRows: rows.length,
      questionCount: questions.length,
      questions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    console.error("[benchmark-datasets] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}