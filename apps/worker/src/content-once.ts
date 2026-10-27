// Explicit production maintenance: bounded real collection and judging, never queue consumers.
// Run collect first, inspect the genuine stored headlines, then pass at most three article IDs to process.
import assert from "node:assert/strict";
import { openSync, closeSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

process.env.LLM_BASE_URL ||= process.env.OPENAI_BASE_URL;
process.env.LLM_API_KEY ||= process.env.OPENAI_API_KEY;
process.env.LLM_MODEL ||= process.env.OPENAI_MODEL;
const { sql, closeDb } = await import("@aihot/backend/db");
const { stopBoss, recordRun } = await import("@aihot/backend/jobs/queue");
const { failureKind } = await import("@aihot/backend/providers/receipts");
const [phase, label, ...ids] = process.argv.slice(2);
const evidence: Record<string, unknown> = { startedAt: new Date().toISOString(), phase, label, ids, timeZone: "Asia/Shanghai", ok: false };
let marker: string | null = null;
let budget: { per_minute: number; per_hour: number; per_day: number } | undefined;
try {
  assert.ok(phase === "collect" || phase === "process", "Use collect or process");
  assert.match(label ?? "", /^[a-z0-9_-]{1,80}$/, "A unique maintenance run label is required");
  assert.ok(ids.length > 0 && ids.length <= (phase === "collect" ? 4 : 3));
  assert.ok(ids.every(id => /^[a-zA-Z0-9_-]{1,120}$/.test(id)));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, "/ainews_prod");
  assert.equal(process.env.LLM_MODEL, "gpt-6-luna");
  assert.equal(process.env.COLLECT_ENABLED, phase === "collect" ? "true" : "false");
  assert.equal(process.env.MODEL_CALLS_ENABLED, phase === "process" ? "true" : "false");
  for (const name of ["FEISHU_CONTENT_PUSH_ENABLED", "FEISHU_INTERNAL_ENABLED", "INDEXNOW_SUBMIT_ENABLED"]) assert.notEqual(process.env[name], "true");
  const dir = path.join(process.env.AIHOT_DATA_DIR!, "content-runs");
  assert.ok(path.isAbsolute(dir));
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const candidate = path.join(dir, label + "-" + phase + ".json");
  assert.equal(existsSync(candidate), false, "Existing evidence requires review; no blind rerun");
  closeSync(openSync(candidate, "wx", 0o600));
  marker = candidate;
  const save = () => writeFileSync(marker!, JSON.stringify(evidence, null, 2), { mode: 0o600 });
  save();
  const result = await recordRun("maintenance.content-once." + phase, async () => {
    if (phase === "collect") {
      const { loadSource, collectSource } = await import("@aihot/backend/sources/collect");
      for (const id of ids) {
        const source = await loadSource(id);
        assert.ok(source?.enabled && source.kind === "rss" && source.participation_mode === "editorial" && !source.config.detail,
          "Use enabled editorial RSS sources without detail crawling");
      }
      const runs: Array<Record<string, unknown>> = [];
      evidence.collection = runs;
      for (const id of ids) {
        const r = await collectSource(id, { maxItems: 5 });
        const [run] = await sql`SELECT id, started_at, finished_at, status FROM fetch_runs WHERE source_id=${id} ORDER BY id DESC LIMIT 1`;
        runs.push({ sourceId: id, status: r.status, found: r.found, created: r.created, revised: r.revised, run, ...(r.error ? { error: "Inspect authenticated fetch run; response omitted" } : {}) });
        save();
      }
      const articles = await sql`SELECT a.id,a.source_id,a.title,a.url,a.published_at,a.discovered_at,a.backfill,a.backfill_reason,a.body_status,a.processing_state,
        EXISTS(SELECT 1 FROM analyses an WHERE an.article_id=a.id AND an.input_revision=a.revision) AS analyzed
        FROM articles a WHERE a.source_id=ANY(${ids}::text[]) ORDER BY a.published_at DESC NULLS LAST,a.id LIMIT 25`;
      evidence.candidates = articles;
      assert.ok(runs.some(r => r.status === "ok"), "No source collection succeeded");
      return { sourceRuns: runs.length, rawFound: runs.reduce((n,r) => n+Number(r.found),0), created: runs.reduce((n,r) => n+Number(r.created),0), revised: runs.reduce((n,r) => n+Number(r.revised),0), candidateCount: articles.length };
    }
    const { capabilities, modelRoute } = await import("@aihot/backend/editorial/models");
    const { MODELS } = await import("@aihot/backend/providers/llm");
    for (const capability of Object.keys(capabilities())) {
      const route = await modelRoute(capability);
      assert.equal(MODELS[route.model]?.model, "gpt-6-luna", "Review the configured capability model before paid work");
      assert.equal(MODELS[route.model]?.service, "llm");
      assert.equal(route.fallbackModel, undefined, "This bounded command permits only the designated model");
    }
    // Narrow the existing provider budget for this one process; never change editorial thresholds.
    [budget] = await sql<{ per_minute: number; per_hour: number; per_day: number }[]>`SELECT per_minute,per_hour,per_day FROM budgets WHERE service='llm'`;
    assert.ok(budget, "A receipt budget is required");
    const [used] = await sql`SELECT count(*) FILTER (WHERE started_at>now()-interval '1 minute')::int AS minute,
      count(*) FILTER (WHERE started_at>now()-interval '1 hour')::int AS hour,count(*)::int AS day
      FROM receipt_attempts WHERE service='llm' AND origin='live' AND started_at>now()-interval '1 day'`;
    evidence.originalBudget = budget;
    const limits = { minute: Math.min(budget.per_minute,used!.minute+30), hour: Math.min(budget.per_hour,used!.hour+30), day: Math.min(budget.per_day,used!.day+30) };
    evidence.temporaryBudget = limits;
    save();
    await sql`UPDATE budgets SET per_minute=${limits.minute},per_hour=${limits.hour},per_day=${limits.day} WHERE service='llm'`;
    const { extractArticleBody } = await import("@aihot/backend/content/extract");
    const { analyzeArticle } = await import("@aihot/backend/editorial/analyze");
    const { groupArticle } = await import("@aihot/backend/events/group");
    const { composeStoryDigest } = await import("@aihot/backend/events/digest");
    const { publishArticle } = await import("@aihot/backend/publication/publish");
    const processing: Array<Record<string, unknown>> = [];
    evidence.processing = processing;
    for (const id of ids) {
      const [article] = await sql`SELECT a.id,a.title,a.url,a.published_at,a.discovered_at,a.backfill,a.backfill_reason,a.body_status,a.revision
        FROM articles a JOIN sources s ON s.id=a.source_id WHERE a.id=${id} AND s.participation_mode='editorial'`;
      assert.ok(article, "Article must be existing editorial material");
      const receipts = await sql`SELECT id,status FROM receipts WHERE subject LIKE ${"article:"+id+"%"}`;
      assert.ok(receipts.every(r => r.status === "completed"), "Unfinished paid work requires review");
      const [current] = await sql`SELECT id FROM analyses WHERE article_id=${id} AND input_revision=${article.revision} ORDER BY id DESC LIMIT 1`;
      if (current) { processing.push({ article, reusedAnalysis: current.id, newModelRequests: 0 }); save(); continue; }
      const record: Record<string, unknown> = { article };
      processing.push(record); save();
      record.extraction = await extractArticleBody(id, { paidFallback: false }); save();
      const judged = await analyzeArticle(id);
      assert.ok(judged?.output && !judged.needsBody && !judged.stale, "Current analysis is required");
      record.analysis = judged; save();
      if (judged.output.relevance === "pass") {
        const grouped = await groupArticle(id);
        record.grouping = { verdict: grouped.verdict, factId: grouped.factId, storyId: grouped.storyId };
        if (grouped.storyId) record.digest = await composeStoryDigest(grouped.storyId);
      }
      record.publication = await publishArticle(id);
      record.stored = await sql`SELECT a.id,a.body_status,length(a.body_text) AS body_chars,a.processing_state,a.grouping_status,
        a.backfill,a.backfill_reason,a.published_at,p.selected,p.eligible,p.score FROM articles a LEFT JOIN publications p ON p.article_id=a.id WHERE a.id=${id}`;
      record.receipts = await sql`SELECT id,model,purpose,status,attempts,usage FROM receipts WHERE subject LIKE ${"article:"+id+"%"} ORDER BY id`;
      save();
    }
    const { computeHotRanking } = await import("@aihot/backend/events/hot");
    evidence.hot = await computeHotRanking();
    const { composeDaily } = await import("@aihot/backend/reports/compose");
    const { beijingDate, beijingAt } = await import("@aihot/contracts/time");
    const { EDITION_TIMES } = await import("@aihot/site");
    const today = beijingDate(Date.now());
    if (beijingAt(today, EDITION_TIMES.daily).getTime() <= Date.now()) {
      try { evidence.daily = { status: "published-or-existing", ...await composeDaily(today) }; }
      catch (error) {
        if (!(error instanceof Error && /nothing judged in its window/.test(error.message))) throw error;
        evidence.daily = { status: "not-published", date: today, reason: "No judged non-backfill reports in the normal edition window; no invented quiet issue" };
      }
    } else evidence.daily = { status: "not-due", date: today };
    const [counts] = await sql`SELECT (SELECT count(*)::int FROM articles) AS articles,(SELECT count(*)::int FROM analyses) AS analyses,
      (SELECT count(*)::int FROM publications WHERE eligible) AS eligible,(SELECT count(*)::int FROM publications WHERE selected) AS selected,
      (SELECT count(*)::int FROM reports) AS reports,(SELECT count(*)::int FROM stories) AS stories`;
    evidence.counts = counts;
    return { processed: processing.length, ...counts };
  });
  evidence.result = result;
  evidence.ok = true;
} catch (error) {
  evidence.error = { name: error instanceof Error ? error.name : "Error", kind: failureKind(error), reason: "Content run stopped; inspect stage evidence and authenticated receipts before retrying" };
  process.exitCode = 1;
} finally {
  if (budget) {
    await sql`UPDATE budgets SET per_minute=${budget.per_minute},per_hour=${budget.per_hour},per_day=${budget.per_day} WHERE service='llm'`;
    evidence.budgetRestored = true;
  }
  evidence.finishedAt = new Date().toISOString();
  if (marker) writeFileSync(marker, JSON.stringify(evidence, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(evidence));
  await stopBoss();
  await closeDb();
}
