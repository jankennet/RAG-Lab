import { z } from "zod";

const positiveIntFromEnv = z.coerce.number().int().positive();

const baseServerEnvSchema = z.object({
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SESSION_ENCRYPTION_KEY: z.string().min(32),
  AUTH_TOKEN: z.string().optional(),
  NIM_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  NIM_API_KEY: z.string().min(1),
  NIM_CHAT_MODEL: z.string().min(1).default("meta/llama-3.3-70b-instruct"),
  NIM_EMBEDDING_MODEL: z.string().optional().default("nvidia/nv-embedqa-e5-v5"),
  NIM_EMBEDDING_DIMENSION: positiveIntFromEnv.optional().default(1024),
});

export const serverEnvSchema = baseServerEnvSchema;

export const ingestionEnvSchema = baseServerEnvSchema.extend({
  HF_DATASET_NAME: z.string().optional().default(""),
  HF_DATASET_CONFIG: z.string().optional().default("default"),
  HF_DATASET_SPLIT: z.string().optional().default("train"),
  HF_DATASET_LIMIT: z.coerce.number().int().positive().optional().default(200),
  HF_INGEST_TITLE_FIELD: z.string().optional().default("title"),
  HF_INGEST_CONTENT_FIELD: z.string().optional().default("text"),
  HF_INGEST_ID_FIELD: z.string().optional().default("id"),
  HF_INGEST_URL_FIELD: z.string().optional().default("url"),
  HF_INGEST_METADATA_FIELDS: z.string().optional().default(""),
});

export const benchmarkEnvSchema = ingestionEnvSchema.extend({
  HF_BENCHMARK_QUESTION_FIELD: z.string().optional().default("question"),
  HF_BENCHMARK_REFERENCE_FIELD: z.string().optional().default("answer"),
  HF_BENCHMARK_LIMIT: z.coerce.number().int().positive().optional().default(25),
});

export function loadEnv<T extends z.ZodType<Record<string, unknown>>>(schema: T, source = process.env): z.infer<T> {
  return schema.parse(source) as z.infer<T>;
}