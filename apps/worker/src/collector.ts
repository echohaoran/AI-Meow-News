// Collection-only production role. It never registers article, event or general cron consumers.
import assert from "node:assert/strict";
import { assertProductionSecrets } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { getBoss, stopBoss } from "@aihot/backend/jobs/queue";
import { startHeartbeat } from "@aihot/backend/operations/heartbeat";
import { registerCollectorJobs } from "./collector-jobs.ts";

assert.equal(process.env.COLLECT_ENABLED, "true", "The collector requires COLLECT_ENABLED=true");
assert.equal(process.env.MODEL_CALLS_ENABLED, "false", "The collector requires MODEL_CALLS_ENABLED=false");
for (const key of ["FEISHU_CONTENT_PUSH_ENABLED", "FEISHU_INTERNAL_ENABLED", "INDEXNOW_SUBMIT_ENABLED"]) {
  assert.notEqual(process.env[key], "true", "External publishing must stay disabled in the isolated collector");
}
assertProductionSecrets([["auth", "IMG_PROXY_SIGN_SECRET"]]);

try {
  const unsupported = await sql`SELECT id FROM sources WHERE enabled
    AND (kind <> 'rss' OR coalesce(config->'detail', 'null'::jsonb) NOT IN ('null'::jsonb, 'false'::jsonb)) LIMIT 1`;
  assert.equal(unsupported.length, 0, "Review non-RSS or detail-crawling sources before starting this collector");
  const boss = await getBoss();
  await registerCollectorJobs(boss);
  const heartbeat = startHeartbeat("collector");
  console.log(JSON.stringify({ level: "info", msg: "collector started", pid: process.pid }));
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(heartbeat);
    console.log(JSON.stringify({ level: "info", msg: "collector stopping" }));
    await stopBoss();
    await closeDb();
    console.log(JSON.stringify({ level: "info", msg: "collector stopped" }));
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} catch (error) {
  // Do not log provider responses or connection strings.
  console.error(JSON.stringify({ level: "error", msg: "collector startup failed", name: error instanceof Error ? error.name : "Error" }));
  await stopBoss();
  await closeDb();
  process.exitCode = 1;
}
