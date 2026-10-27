import { guardedFetch, requireOk } from "@aihot/backend/lib/http-fetch";
import { sql } from "@aihot/backend/db";
import { shutdownSignal } from "@aihot/backend/jobs/queue";
import { loadPublicSnapshot, publicSnapshotKey } from "@aihot/backend/publication/snapshots";
import { CATEGORIES, PERIODS, type RankingBoard, type RankingsSnapshot } from "../contracts.ts";
import { parseApps, parseBenchmarks, parseCatalog, parseModels } from "./parse.ts";

const BASE = "https://openrouter.ai/api/frontend/v1/";
export type ReadJson = (path: string) => Promise<unknown>;

export const readOpenRouter: ReadJson = async (path) => {
  const response = requireOk(await guardedFetch(BASE + path, { timeoutMs: 30_000, maxBytes: 12 * 1024 * 1024, headers: { accept: "application/json" } }), "OpenRouter rankings");
  return JSON.parse(response.text());
};

/** Pure assembly is shared by the worker and fixture/real-source verification; readers never call it. */
export async function collectSnapshot(read: ReadJson, previous: RankingsSnapshot | null, now = new Date()): Promise<RankingsSnapshot> {
  const fetchedAt = now.toISOString();
  const names = parseCatalog(await read("catalog/models"));
  const boards = new Map((previous?.boards ?? []).map((board) => [board.id, board]));
  const failures: RankingsSnapshot["failures"] = [];
  const jobs: Array<{ id: string; run: () => Promise<RankingBoard[]> }> = [];
  for (const category of CATEGORIES.filter((c) => !["apps", "benchmarks"].includes(c.id))) {
    for (const period of PERIODS) {
      const endpoint = category.id === "batch" ? `rankings/models?metric=requests&modality=all&traffic=batch&view=${period.id}`
        : category.id === "text" ? `rankings/models?view=${period.id}`
        : `rankings/modality-models?routeSegment=${category.id}&view=${period.id}`;
      jobs.push({ id: `${category.id}:${period.id}`, run: async () => [parseModels(await read(endpoint), category.id, period.id, names, fetchedAt)] });
    }
  }
  jobs.push({ id: "apps", run: async () => parseApps(await read("rankings/apps"), fetchedAt) });
  jobs.push({ id: "benchmarks", run: async () => parseBenchmarks(await read("rankings/benchmarks"), names, fetchedAt) });
  // Two outbound reads at once. Every result settles before another batch begins.
  for (let i = 0; i < jobs.length; i += 2) {
    shutdownSignal.signal.throwIfAborted();
    const batch = jobs.slice(i, i + 2);
    const results = await Promise.allSettled(batch.map((job) => job.run()));
    for (const [index, result] of results.entries()) {
      const job = batch[index];
      if (result.status === "rejected") {
        failures.push({ id: job.id, message: "本次抓取失败，已有快照保留；请查看后台任务记录。" });
        continue;
      }
      if (job.id === "apps" || job.id === "benchmarks") {
        for (const [id, board] of boards) if (board.category === job.id) boards.delete(id);
      }
      for (const board of result.value) boards.set(board.id, board);
    }
  }
  if (!boards.size) throw new Error("OpenRouter returned no usable ranking boards");
  return { checkedAt: fetchedAt, boards: [...boards.values()], failures };
}

export async function refreshRankings(read: ReadJson = readOpenRouter) {
  if (process.env.COLLECT_ENABLED !== "true") return { skipped: "collection disabled" };
  const previous = await loadPublicSnapshot<RankingsSnapshot>("openrouter-rankings");
  const snapshot = await collectSnapshot(read, previous);
  await sql`INSERT INTO settings (key, value) VALUES (${publicSnapshotKey("openrouter-rankings")}, ${sql.json(snapshot as never)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  return { boards: snapshot.boards.length, failed: snapshot.failures.length };
}
