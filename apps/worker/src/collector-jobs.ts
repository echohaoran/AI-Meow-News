// RSS collection can stay live while analysis and extraction queues remain parked.
import type { PgBoss } from "pg-boss";
import { loadSource, collectSource, scheduleDueSources } from "@aihot/backend/sources/collect";
import { ensureQueue, QUEUES, recordRun, work } from "@aihot/backend/jobs/queue";

export async function registerCollectorJobs(boss: PgBoss) {
  await work(boss, QUEUES.fetchSource, { localConcurrency: 2, pollingIntervalSeconds: 2 }, async ({ sourceId, force }) => {
    const source = await loadSource(sourceId);
    // This deployment has only RSS sources without detail crawling. Do not silently enable a new
    // paid collector or page-crawling mode if an administrator later changes one.
    if (!source || source.kind !== "rss" || source.config.detail) {
      return { sourceId, status: "skipped", reason: "The isolated collector accepts RSS without detail crawling" };
    }
    return collectSource(sourceId, { force });
  });
  const queue = "cron.sources.schedule";
  await ensureQueue(queue, { policy: "singleton", retryLimit: 1, expireInSeconds: 3600 });
  await boss.schedule(queue, "* * * * *", {}, { tz: "Asia/Shanghai", missed: "skip" });
  await boss.work(queue, { pollingIntervalSeconds: 15 }, async () => recordRun("sources.schedule", scheduleDueSources));
}
