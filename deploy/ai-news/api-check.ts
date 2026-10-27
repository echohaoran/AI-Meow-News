// Read-only acceptance against the real loopback API and the existing development database.
import assert from "node:assert/strict";
import type { SourceItemsResponse, SiteItemDetail, TimelineResponse } from "@aihot/contracts/site";
import { writeFileSync } from "node:fs";
import { sql, closeDb } from "@aihot/backend/db";
const evidence = "/mnt/local_data/File/AI-News/00-临时文件/开发接续/后端";
try {
  assert.equal(new URL(process.env.DATABASE_URL!).pathname.slice(1), "ainews_dev");
  const [{ n: before }] = await sql`SELECT count(*)::int AS n FROM receipts`;
  const get = async (path: string, status = 200) => {
    const response = await fetch("http://127.0.0.1:43182" + path, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, status, path);
    return response;
  };
  const health = await (await get("/api/health")).json() as {db: string};
  assert.equal(health.db, "ok");
  const response = await get("/api/site/source-items?sourceId=rss-openai-news&limit=3");
  const body = await response.json() as SourceItemsResponse;
  assert.equal(body.items.length, 3);
  assert.ok(body.items.every((x) =>
    x.verificationStatus === "unverified" && x.selected === false && !!x.sourceSummary));
  const original = body.items[0]!;
  const detail = await (await get("/api/site/items/" + original.id)).json() as SiteItemDetail;
  assert.equal(detail.id, original.id);
  assert.equal(detail.summary, null);
  assert.equal(detail.selected, false);
  assert.equal(detail.body, null);
  assert.equal(detail.indexable, false);
  const search = await (await get("/api/site/source-items?sourceId=rss-openai-news&q=storage")).json() as SourceItemsResponse;
  assert.ok(search.items.some((x) => x.id === original.id));
  await get("/api/site/source-items?limit=0", 400);
  await get("/api/admin/me", 401);
  const curated = await (await get("/api/site/timeline")).json() as TimelineResponse;
  assert.equal(curated.cards.length, 0);
  const unchanged = await fetch("http://127.0.0.1:43182/api/site/source-items?sourceId=rss-openai-news&limit=3",
    { headers: { "if-none-match": response.headers.get("etag")! } });
  assert.equal(unchanged.status, 304);
  const [{ n: after }] = await sql`SELECT count(*)::int AS n FROM receipts`;
  assert.equal(before, after);
  const stored = await sql`SELECT a.id, a.title, a.url, a.published_at, a.discovered_at, a.publication_time,
    a.excerpt, a.backfill, a.processing_state, p.eligible, p.selected
    FROM articles a JOIN publications p ON p.article_id=a.id WHERE a.source_id='rss-openai-news' ORDER BY a.published_at DESC`;
  const result = { ok: true, health, sourceCount: body.items.length, sourceItems: body.items,
    stored, curatedCount: curated.cards.length, receiptCountBefore: before, receiptCountAfter: after,
    detail: { id: detail.id, summary: detail.summary, selected: detail.selected, readingMode: detail.readingMode },
    checks: ["real-source-page", "source-search", "original-detail", "invalid-input", "anonymous-admin-denial", "etag-304", "no-reader-model-calls"] };
  writeFileSync(evidence + "/real-api.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ok:true,sourceCount:body.items.length,curatedCount:0,receiptCountBefore:before,receiptCountAfter:after,checks:result.checks}));
} catch (error) {
  // Assertions carry only public response expectations, never connection strings.
  console.error(error instanceof assert.AssertionError ? error.message : "Real API acceptance failed");
  process.exitCode=1;
} finally { await closeDb(); }
