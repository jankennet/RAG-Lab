/** NIM embedding via direct API call. */

const BASE_URL = "https://integrate.api.nvidia.com/v1";

export async function embedBatch(texts: string[], apiKey: string, model = "nvidia/nv-embedqa-e5-v5"): Promise<number[][]> {
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts.map((t) => t.replace(/\0/g, "")),
      model,
      input_type: "passage",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NIM embed failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}