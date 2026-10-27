// Apply a reviewed, bounded summary correction through the native audited editorial command.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { sql, closeDb } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { overrideFields } from "@aihot/backend/admin/content";

const Plan = z.array(z.object({
  id: z.string().regex(/^[a-z0-9]{1,80}$/),
  summary: z.string().min(1).max(2000),
  reason: z.string().min(1).max(1500),
}).strict()).min(1).max(3);
try {
  assert.equal(process.argv.length, 3);
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, "/ainews_prod");
  assert.equal(process.env.COLLECT_ENABLED, "false");
  assert.equal(process.env.MODEL_CALLS_ENABLED, "false");
  const plan = Plan.parse(JSON.parse(readFileSync(process.argv[2]!, "utf8")));
  assert.equal(new Set(plan.map(p => p.id)).size, plan.length);
  const [beforeCounts] = await sql`SELECT (SELECT count(*)::int FROM analyses) AS analyses,
    (SELECT count(*)::int FROM receipts) AS receipts,(SELECT count(*)::int FROM receipt_attempts) AS attempts,
    (SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY a.id)) FROM analyses a) AS analysis_digest`;
  const results = [];
  for (const item of plan) {
    const [before] = await sql`SELECT a.id,a.revision,a.published_at,a.discovered_at,a.timeline_at,a.backfill,a.backfill_reason,
      p.score,p.selected,p.eligible FROM articles a JOIN publications p ON p.article_id=a.id WHERE a.id=${item.id}`;
    assert.ok(before, "Only existing published material can be corrected");
    const [prior] = await sql<{ version: number; fields: Record<string, unknown> }[]>`SELECT version,fields FROM editorial_overrides WHERE article_id=${item.id}`;
    const reused = prior?.fields.summary === item.summary;
    if (!reused) await overrideFields(item.id, { fields: { summary: item.summary }, reason: item.reason, version: prior?.version ?? 0 }, "ai-news-factual-review");
    const [after] = await sql`SELECT a.id,a.revision,a.published_at,a.discovered_at,a.timeline_at,a.backfill,a.backfill_reason,
      p.score,p.selected,p.eligible FROM articles a JOIN publications p ON p.article_id=a.id WHERE a.id=${item.id}`;
    assert.deepEqual(after, before, "A summary correction must preserve material, dates, scoring and selection");
    const [publicRow] = await sql`SELECT article_id,title,summary FROM publications WHERE article_id=${item.id}`;
    assert.equal(publicRow?.summary, item.summary);
    results.push({ id: item.id, reused, publication: publicRow, materialAndJudgementUnchanged: true });
  }
  const [afterCounts] = await sql`SELECT (SELECT count(*)::int FROM analyses) AS analyses,
    (SELECT count(*)::int FROM receipts) AS receipts,(SELECT count(*)::int FROM receipt_attempts) AS attempts,
    (SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY a.id)) FROM analyses a) AS analysis_digest`;
  assert.deepEqual(afterCounts, beforeCounts, "Raw model results and receipt counts must stay intact");
  console.log(JSON.stringify({ ok: true, results, modelDataUnchanged: true, counts: afterCounts }));
} catch {
  console.error("Editorial correction stopped; inspect the approved plan and versioned audit before retrying");
  process.exitCode = 1;
} finally { await stopBoss(); await closeDb(); }
