// Failure cases: a working official endpoint may require another ordinary collector; replacing it
// must not recreate the source, reset backfill, leave old validators, skip audit/publication, accept
// an incomplete config, race a stale edit, or turn a paid/module-managed kind into a free collector.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { updateSource } from "@aihot/backend/admin/sources";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { republishKey } from "@aihot/backend/jobs/publication";
import { stopBoss } from "@aihot/backend/jobs/queue";

after(async () => { await stopBoss(); await closeDb(); });
async function source(kind = "rss", config: Record<string, unknown> = { feedUrl: `https://example.com/${tag()}` }) {
  const id = `replace-${tag()}`;
  const [row] = await sql`INSERT INTO sources (id, name, kind, config) VALUES (${id}, ${id}, ${kind}, ${sql.json(config as never)}) RETURNING *`;
  return row!;
}
async function edit(id: string, patch: unknown) {
  const [row] = await sql`SELECT updated_at FROM sources WHERE id = ${id}`;
  return updateSource(id, { patch, version: (row!.updated_at as Date).toISOString(), reason: "Official collection endpoint changed" }, "test-replacement");
}
const jsonConfig = () => ({ url: `https://example.com/${tag()}.json`, titlePaths: ["name"], urlTemplate: "https://example.com/news/{id}" });

test("ordinary collector replacement retains source, history and admission boundaries and resets only collector validators", async () => {
  const boundary = "2026-10-01T00:00:00.000Z";
  const row = await source("rss", { feedUrl: `https://example.com/${tag()}`, publishedAfter: boundary });
  const cursor = { initializedAt: "2026-09-30T00:00:00.000Z", lastOkAt: "2026-10-02T00:00:00.000Z", rss: { etag: "old-validator" }, detailRules: "old-rules" };
  await sql`UPDATE sources SET cursor = ${sql.json(cursor)} WHERE id = ${row.id}`;
  const material = await upsertMaterial({ sourceId: row.id, url: `https://example.com/${tag()}`, title: "Existing article", publishedAt: new Date(boundary), via: "fetch" });
  const replacement = await edit(row.id, { kind: "web_list", config: { url: `https://example.com/${tag()}`, itemSelector: "article" } });
  assert.equal(replacement!.kind, "web_list");
  assert.equal(replacement!.id, row.id);
  assert.equal(replacement!.config.publishedAfter, boundary);
  assert.deepEqual(replacement!.cursor, { initializedAt: cursor.initializedAt, lastOkAt: cursor.lastOkAt });
  assert.equal((await sql`SELECT id FROM articles WHERE source_id = ${row.id}`)[0]!.id, material.articleId);
  assert.equal((await sql`SELECT value FROM settings WHERE key = ${republishKey(row.id)}`)[0]!.value.status, "queued");
  const [audit] = await sql`SELECT before, after FROM audit_log WHERE subject = ${`source:${row.id}`} ORDER BY id DESC LIMIT 1`;
  assert.equal(audit!.before.kind, "rss");
  assert.equal(audit!.after.kind, "web_list");
  assert.equal(audit!.after.config.publishedAfter, boundary);
  assert.deepEqual(audit!.before.cursor, cursor);
  assert.deepEqual(audit!.after.cursor, replacement!.cursor);
  const second = await edit(row.id, { kind: "json_list", config: jsonConfig() });
  assert.equal(second!.id, row.id);
  assert.equal(second!.config.publishedAfter, boundary);
  await assert.rejects(edit(row.id, { kind: "rss", config: { feedUrl: "https://example.com/older", publishedAfter: "2020-01-01T00:00:00.000Z" } }));
  await assert.rejects(updateSource(row.id, { patch: { kind: "rss", config: { feedUrl: "https://example.com/changed" } }, version: (row.updated_at as Date).toISOString() }, "stale"), { code: "conflict" });
});

test("collector replacement refuses incomplete, incompatible, duplicate or special-kind inputs atomically", async () => {
  const row = await source();
  for (const patch of [
    { kind: "json_list" }, { kind: "json_list", config: {} },
    { kind: "json_list", config: { feedUrl: "https://example.com/feed" } },
    { kind: "json_list", config: { url: "https://example.com/list" } },
    ...["x_search", "mp_account", "external"].map(kind => ({ kind, config: {} })),
  ]) await assert.rejects(edit(row.id, patch));
  for (const kind of ["x_search", "mp_account", "external"]) {
    const special = await source(kind, {});
    await assert.rejects(edit(special.id, { kind: "rss", config: { feedUrl: "https://example.com/feed" } }));
  }
  const config = jsonConfig();
  await source("json_list", config);
  await assert.rejects(edit(row.id, { kind: "json_list", config }), { code: "conflict" });
  assert.equal((await sql`SELECT kind FROM sources WHERE id = ${row.id}`)[0]!.kind, "rss");
  assert.equal((await sql`SELECT 1 FROM audit_log WHERE subject = ${`source:${row.id}`}`).length, 0);
});

test("publisher attribution changes queue re-derivation for role, URL ownership and discovery evidence", async () => {
  for (const change of [
    { publisherRole: "person" }, { publisherUrlPrefixes: ["https://example.org/"] }, { publisherRequiresDiscovery: true },
  ]) {
    const config = { feedUrl: `https://example.com/${tag()}`, publisherRole: "organization", publisherUrlPrefixes: ["https://example.com/"], publisherRequiresDiscovery: false };
    const row = await source("rss", config);
    await edit(row.id, { config: { ...config, ...change } });
    assert.equal((await sql`SELECT value FROM settings WHERE key = ${republishKey(row.id)}`)[0]?.value.status, "queued", JSON.stringify(change));
  }
});

test("isolated RSS collector ingests and deduplicates while leaving analysis, extraction and unrelated schedules untouched", async (t) => {
  const { createServer } = await import("node:http");
  const { setTimeout: delay } = await import("node:timers/promises");
  const { getBoss, enqueue, QUEUES } = await import("@aihot/backend/jobs/queue");
  const { registerCollectorJobs } = await import("../apps/worker/src/collector-jobs.ts");
  const { config } = await import("@aihot/backend/config");
  const privateFetch = config.allowPrivateNetworkFetch;
  config.allowPrivateNetworkFetch = true;
  t.after(() => { config.allowPrivateNetworkFetch = privateFetch; });
  await sql`UPDATE sources SET enabled = false`;
  let requests = 0;
  const itemUrl = `https://example.org/isolated-${tag()}`;
  const date = new Date().toUTCString();
  const server = createServer((_req, res) => {
    requests++;
    res.writeHead(200, { "content-type": "application/rss+xml" });
    res.end(`<rss version="2.0"><channel><title>Local RSS</title><item><guid>${itemUrl}</guid><link>${itemUrl}</link><title>Real local feed fixture</title><description>Fixture summary</description><pubDate>${date}</pubDate></item></channel></rss>`);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const row = await source("rss", { feedUrl: `http://127.0.0.1:${address.port}/feed` });
  const boss = await getBoss();
  const oldIds = [
    await enqueue(QUEUES.analyze, { articleId: "parked-analysis" }),
    await enqueue(QUEUES.extractBody, { articleId: "parked-extraction" }),
    await enqueue(QUEUES.group, { articleId: "parked-grouping" }),
    await enqueue(QUEUES.digest, { storyId: 987654 }),
  ].filter((id): id is string => !!id);
  assert.equal(oldIds.length, 4);
  const parked = () => sql`SELECT to_jsonb(j) AS row FROM pgboss.job j WHERE id = ANY(${oldIds}::uuid[]) ORDER BY id`;
  const before = await parked();
  const [used] = await sql`SELECT count(*)::int AS count FROM receipt_attempts`;
  await boss.createQueue("cron.test.keep");
  await boss.schedule("cron.test.keep", "0 0 * * *", {}, { tz: "Asia/Shanghai" });
  await registerCollectorJobs(boss);
  const schedules = await boss.getSchedules();
  assert.ok(schedules.some(s => s.name === "cron.test.keep"), "collector must not retire another role's schedule");
  const scheduled = schedules.find(s => s.name === "cron.sources.schedule");
  assert.ok(scheduled);
  assert.equal(scheduled.cron, "* * * * *");
  assert.equal(scheduled.timezone, "Asia/Shanghai");
  const waitFor = async (predicate: () => Promise<boolean>) => {
    const deadline = Date.now() + 35_000;
    while (!await predicate()) {
      assert.ok(Date.now() < deadline, "collector did not finish the local scheduled fetch");
      await delay(100);
    }
  };
  const successful = async () => (await sql`SELECT count(*)::int AS count FROM fetch_runs WHERE source_id = ${row.id} AND status = 'ok'`)[0]!.count;
  await boss.send("cron.sources.schedule", {});
  await waitFor(async () => await successful() >= 1);
  const articles = await sql`SELECT id, revision, published_at FROM articles WHERE source_id = ${row.id}`;
  assert.equal(articles.length, 1);
  assert.equal(articles[0]!.published_at.toISOString(), new Date(date).toISOString());
  assert.equal((await sql`SELECT processing_state FROM articles WHERE id = ${articles[0]!.id}`)[0]!.processing_state, "new");
  await sql`UPDATE sources SET next_fetch_at = now() - interval '1 minute' WHERE id = ${row.id}`;
  await boss.send("cron.sources.schedule", {});
  await waitFor(async () => await successful() >= 2);
  assert.ok(requests >= 2);
  assert.deepEqual(await sql`SELECT id, revision, published_at FROM articles WHERE source_id = ${row.id}`, articles);
  assert.deepEqual(await parked(), before, "no parked processing task may be claimed or changed");
  assert.equal((await sql`SELECT count(*)::int AS count FROM receipt_attempts`)[0]!.count, used!.count);
  assert.ok((await sql`SELECT count(*)::int AS count FROM job_runs WHERE job = 'sources.schedule' AND status = 'ok'`)[0]!.count >= 2);
});

test("isolated collector refuses startup with model calls enabled before accessing the database", async () => {
  const { spawnSync } = await import("node:child_process");
  const run = spawnSync(process.execPath, ["apps/worker/src/collector.ts"], {
    env: { ...process.env, COLLECT_ENABLED: "true", MODEL_CALLS_ENABLED: "true", DATABASE_URL: "postgres://127.0.0.1:1/unreachable_test" },
    encoding: "utf8", timeout: 10_000,
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /requires MODEL_CALLS_ENABLED=false/);
});
