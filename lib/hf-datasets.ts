import { z } from "zod";

const hfRowSchema = z.object({
  row: z.record(z.any())
});

const hfRowsResponseSchema = z.object({
  rows: z.array(hfRowSchema),
  features: z.array(z.any()).optional(),
  total: z.number().optional()
});

export type HuggingFaceDatasetConfig = {
  datasetName: string;
  datasetConfig: string;
  split: string;
  limit: number;
  pageSize?: number;
};

export async function fetchHuggingFaceDatasetRows(config: HuggingFaceDatasetConfig) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = config.pageSize ?? 100;

  for (let offset = 0; rows.length < config.limit; offset += pageSize) {
    const url = new URL("https://datasets-server.huggingface.co/rows");
    url.searchParams.set("dataset", config.datasetName);
    url.searchParams.set("config", config.datasetConfig);
    url.searchParams.set("split", config.split);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("length", String(Math.min(pageSize, config.limit - rows.length)));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Hugging Face Datasets request failed: ${response.status} ${response.statusText}`);
    }

    const parsed = hfRowsResponseSchema.parse(await response.json());

    if (parsed.rows.length === 0) {
      break;
    }

    rows.push(...parsed.rows.map((entry) => entry.row));

    if (parsed.rows.length < pageSize) {
      break;
    }
  }

  return rows.slice(0, config.limit);
}