// One existing real source article, at most ten model requests; no worker or report creation.
import assert from "node:assert/strict";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { sql, closeDb } from "@aihot/backend/db";
import { extractArticleBody } from "@aihot/backend/content/extract";
import { analyzeArticle } from "@aihot/backend/editorial/analyze";
import { groupArticle } from "@aihot/backend/events/group";
import { publishArticle } from "@aihot/backend/publication/publish";
import { stopBoss } from "@aihot/backend/jobs/queue";
const evidence = "/mnt/local_data/File/AI-News/00-临时文件/开发接续/全栈";
const marker = evidence + "/news-check-result.json";
const result: Record<string, unknown> = { startedAt: new Date().toISOString(), scope: "one existing real RSS article; not independent fact verification" };
let budget: { per_minute: number; per_hour: number; per_day: number } | undefined;
try {
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, "/ainews_dev");
  assert.equal(process.env.MODEL_CALLS_ENABLED, "true");
  assert.equal(process.env.COLLECT_ENABLED, "false");
  if (existsSync(marker)) {
    const prior = JSON.parse(readFileSync(marker, "utf8")) as { ok?: boolean };
    console.log(JSON.stringify({ reusedCheck: true, previousOk: prior.ok ?? false, requestsSent: 0 }));
  } else {
    const [article] = await sql`SELECT id,title,backfill,published_at FROM articles WHERE source_id='rss-openai-news' ORDER BY published_at DESC,id DESC LIMIT 1`;
    assert.ok(article);
    result.article = article;
    const previous = await sql`SELECT id,status,purpose,usage FROM receipts WHERE subject LIKE ${"article:" + article.id + "%"}`;
    const [analysis] = await sql`SELECT id FROM analyses WHERE article_id=${article.id} LIMIT 1`;
    result.priorReceipts = previous;
    // Unknown/failed/in-flight paid work is never blindly retried by this acceptance command.
    assert.equal(previous.length, 0, "Existing article receipts require review; no paid retry");
    assert.equal(analysis, undefined, "Existing analysis requires review; no duplicate evaluation");
    [budget] = await sql<{ per_minute: number; per_hour: number; per_day: number }[]>`SELECT per_minute,per_hour,per_day FROM budgets WHERE service='llm'`;
    assert.ok(budget);
    const [used] = await sql`SELECT count(*) FILTER (WHERE started_at > now()-interval '1 minute')::int AS minute,
      count(*) FILTER (WHERE started_at > now()-interval '1 hour')::int AS hour,count(*)::int AS day
      FROM receipt_attempts WHERE service='llm' AND origin='live' AND started_at > now()-interval '1 day'`;
    const limits = { minute: Math.min(budget.per_minute, used!.minute + 10), hour: Math.min(budget.per_hour, used!.hour + 10), day: Math.min(budget.per_day, used!.day + 10) };
    result.temporaryBudget = limits;
    writeFileSync(evidence + "/news-check-budget-restore.json", JSON.stringify(budget, null, 2));
    await sql`UPDATE budgets SET per_minute=${limits.minute},per_hour=${limits.hour},per_day=${limits.day} WHERE service='llm'`;
    result.extraction = await extractArticleBody(article.id, { paidFallback: false });
    // Inaccessible pages become unconfirmed; the framework judges the genuine stored RSS excerpt.
    const judged = await analyzeArticle(article.id);
    result.analysis = judged;
    assert.ok(judged?.output && !judged.needsBody && !judged.stale, "A current real analysis is required");
    result.grouping = await groupArticle(article.id);
    result.publication = await publishArticle(article.id);
    result.ok = true;
  }
} catch (error) {
  result.ok = false;
  result.error = error instanceof assert.AssertionError ? error.message : error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]") : "News check failed";
  // Provider diagnostics stay in authenticated receipts; do not print API response bodies.
  console.error("Bounded news acceptance failed; inspect news-check-result.json and authenticated receipts");
  process.exitCode = 1;
} finally {
  if (budget) {
    await sql`UPDATE budgets SET per_minute=${budget.per_minute},per_hour=${budget.per_hour},per_day=${budget.per_day} WHERE service='llm'`;
    result.budgetRestored = true;
  }
  if (result.article) {
    const articleId = (result.article as {id:string}).id;
    result.receipts = await sql`SELECT id,model,purpose,subject,status,attempts,usage FROM receipts WHERE subject LIKE ${"article:"+articleId+"%"} ORDER BY id`;
    result.stored = await sql`SELECT a.id,a.revision,a.body_status,length(a.body_text) AS body_chars,a.processing_state,a.grouping_status,a.backfill,a.published_at,p.selected,p.eligible FROM articles a LEFT JOIN publications p ON p.article_id=a.id WHERE a.id=${articleId}`;
    result.counts = (await sql`SELECT (SELECT count(*) FROM analyses)::int AS analyses,(SELECT count(*) FROM reports)::int AS reports`)[0];
    result.finishedAt = new Date().toISOString();
    writeFileSync(marker, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: result.ok, articleId, budgetRestored: result.budgetRestored, counts: result.counts }));
  }
  await stopBoss();
  await closeDb();
}
