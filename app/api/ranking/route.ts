import { NextResponse } from "next/server";
import { getRuns } from "@/server/benchmarks/store";

export const runtime = "nodejs";

/** Group runs by (datasetName × model × provider) and return comparison. */
export async function GET() {
  try {
    const runs = getRuns();

    if (runs.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    // Group by datasetName + model + provider
    const groupMap = new Map<string, typeof runs>();
    for (const run of runs) {
      // Only completed runs
      if (run.status !== "completed") continue;
      const key = `${run.datasetName}::${run.provider}::${run.model}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(run);
    }

    const groups = Array.from(groupMap.entries())
      .map(([key, groupRuns]) => {
        const [datasetName, provider, model] = key.split("::");
        // Latest run per group
        const latest = groupRuns.sort((a, b) => b.createdAt - a.createdAt)[0];
        return {
          datasetName,
          provider,
          model,
          runCount: groupRuns.length,
          metrics: latest.metrics,
          lastRunAt: latest.createdAt,
          runId: latest.id,
        };
      })
      // Sort: best F1 first
      .sort((a, b) => b.metrics.tokenF1 - a.metrics.tokenF1);

    // Also compute per-dataset ranking
    const datasetGroups = new Map<string, typeof groups>();
    for (const g of groups) {
      if (!datasetGroups.has(g.datasetName)) datasetGroups.set(g.datasetName, []);
      datasetGroups.get(g.datasetName)!.push(g);
    }

    const byDataset = Array.from(datasetGroups.entries())
      .map(([name, entries]) => ({
        datasetName: name,
        models: entries.sort((a, b) => b.metrics.tokenF1 - a.metrics.tokenF1),
      }))
      .sort((a, b) => b.models.length - a.models.length);

    return NextResponse.json({ groups, byDataset });
  } catch (error) {
    console.error("[ranking] error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to compute ranking" }, { status: 500 });
  }
}