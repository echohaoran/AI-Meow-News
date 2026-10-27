// Explicit bounded acceptance/maintenance command; no queue consumers or schedules are started.
import { collectSource, loadSource } from "@aihot/backend/sources/collect";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { closeDb } from "@aihot/backend/db";

const [sourceId, count = "3", ...extra] = process.argv.slice(2);
try {
  if (!sourceId || extra.length || !/^[a-zA-Z0-9_-]{1,120}$/.test(sourceId) || !/^[1-9][0-9]*$/.test(count) || Number(count) > 5) {
    throw new Error("Usage: collect-once.ts SOURCE_ID [1..5]");
  }
  if (process.env.COLLECT_ENABLED !== "true" || process.env.MODEL_CALLS_ENABLED !== "false") {
    throw new Error("Set COLLECT_ENABLED=true and MODEL_CALLS_ENABLED=false explicitly for this one process");
  }
  const source = await loadSource(sourceId);
  if (!source || source.kind !== "rss" || !source.enabled) throw new Error("An enabled RSS source is required");
  // A one-shot feed check must not expand into detail-page collection.
  if (source.config.detail) throw new Error("Source detail fetching is not permitted in this bounded command");
  const result = await collectSource(sourceId, { maxItems: Number(count) });
  console.log(JSON.stringify({ ...result, error: result.error ? "Collection failed; inspect the authenticated fetch run" : undefined }));
  if (result.status !== "ok") process.exitCode = 1;
} catch (error) {
  // Source URLs/connection strings in errors are not safe console output.
  console.error(error instanceof Error && /^(Usage:|Set COLLECT_|An enabled|Source detail)/.test(error.message) ? error.message : "Bounded collection failed");
  process.exitCode = 1;
} finally {
  await stopBoss();
  await closeDb();
}
