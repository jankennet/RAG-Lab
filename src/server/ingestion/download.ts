/** Fetch raw data from URL. */

export type DownloadResult = {
  raw: string;
  contentType: string;
};

export async function download(url: string): Promise<DownloadResult> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ROS/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  return { raw, contentType };
}

/** Download rows from HuggingFace datasets-server API. */
export async function downloadHfRows(
  datasetName: string,
  config = "default",
  split = "train",
  limit = 200,
): Promise<DownloadResult> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 100;

  for (let offset = 0; rows.length < limit; offset += pageSize) {
    const url = new URL("https://datasets-server.huggingface.co/rows");
    url.searchParams.set("dataset", datasetName);
    url.searchParams.set("config", config);
    url.searchParams.set("split", split);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("length", String(Math.min(pageSize, limit - rows.length)));

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HF request failed: ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { rows: Array<{ row: Record<string, unknown> }> };
    if (!body.rows?.length) break;
    rows.push(...body.rows.map((r) => r.row));
    if (body.rows.length < pageSize) break;
  }

  return {
    raw: JSON.stringify(rows.slice(0, limit)),
    contentType: "application/json",
  };
}