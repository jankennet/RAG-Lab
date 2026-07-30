import { z } from "zod";

const baseServerEnvSchema = z.object({
  SESSION_ENCRYPTION_KEY: z.string().min(32),
  AUTH_TOKEN: z.string().optional(),
  NIM_API_KEY: z.string().min(1),
  NIM_EMBEDDING_MODEL: z.string().optional().default("nvidia/nv-embedqa-e5-v5"),
  NIM_EMBEDDING_DIMENSION: z.coerce.number().int().positive().optional().default(1024),
});

export const serverEnvSchema = baseServerEnvSchema;

export function loadEnv<T extends z.ZodType<Record<string, unknown>>>(schema: T, source = process.env): z.infer<T> {
  return schema.parse(source) as z.infer<T>;
}