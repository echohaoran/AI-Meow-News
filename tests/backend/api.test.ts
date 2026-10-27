// A single pre-created *_test database; no database copies, CREATEDB or external providers.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import http from "node:http";
import { after, test } from "node:test";

const name = new URL(process.env.DATABASE_URL ?? "postgres://unset/unset").pathname.slice(1);
if (!/_(test|ci)$/.test(name)) throw new Error("Use an isolated *_test or *_ci database");
process.env.MODEL_CALLS_ENABLED = "false";
process.env.COLLECT_ENABLED = "false";
process.env.FEISHU_CONTENT_PUSH_ENABLED = "false";
process.env.FEISHU_INTERNAL_ENABLED = "false";
process.env.INDEXNOW_SUBMIT_ENABLED = "false";
process.env.ADMIN_PASSWORD = randomBytes(24).toString("hex");
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.IMG_PROXY_SIGN_SECRET = randomBytes(32).toString("hex");
process.env.LOG_LEVEL = "silent";
delete process.env.DEV_AUTH_ROLE;

const { sql, closeDb } = await import("@aihot/backend/db");
const { config } = await import("@aihot/backend/config");
const { stopBoss } = await import("@aihot/backend/jobs/queue");
const { collectSource } = await import("@aihot/backend/sources/collect");
const { publishArticle } = await import("@aihot/backend/publication/publish");
const { assertPublicUrl } = await import("@aihot/backend/lib/url");
const { chatJson } = await import("@aihot/backend/providers/llm");
const { z } = await import("zod");
const { adminHandler } = await import("../../apps/api/src/routes/admin-auth.ts");
const { buildApp } = await import("../../apps/api/src/app.ts");
const app = await buildApp();
app.get("/api/admin/acceptance-failure", adminHandler(async () => { throw new Error("sensitive-database-diagnostic"); }));
after(async () => { await app.close(); await stopBoss(); await closeDb(); });

test("bounded RSS, source reading, search, withdrawal, and no-model receipts", async () => {
  const id = "backend-acceptance-" + randomBytes(6).toString("hex");
  const published = new Date(Date.now() - 3600_000).toUTCString();
  const feed = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/rss+xml" });
    res.end('<rss version="2.0"><channel><title>Local test fixture</title>' +
      [1, 2, 3].map(n => '<item><title>Fixture item ' + n + '</title><link>https://example.org/' + id + '/' + n + '</link><description>Source excerpt ' + n + '</description><pubDate>' + published + '</pubDate></item>').join("") + '</channel></rss>');
  });
  await new Promise<void>(resolve => feed.listen(0, "127.0.0.1", resolve));
  const port = (feed.address() as { port: number }).port;
  try {
    await sql`INSERT INTO sources (id,name,kind,config,tier,participation_mode,site_fulltext,syndicate_fulltext)
      VALUES (${id}, 'Local fixture', 'rss', ${sql.json({feedUrl: "http://127.0.0.1:" + port + "/rss"})}, 'T1', 'editorial', false, false)`;
    config.allowPrivateNetworkFetch = true; // Only the local fixture server above.
    const first = await collectSource(id, { maxItems: 2 });
    const again = await collectSource(id, { maxItems: 2 });
    assert.equal(first.status, "ok"); assert.equal(first.created, 2);
    assert.equal(again.status, "ok"); assert.equal(again.created, 0);
    const articles = await sql`SELECT id, excerpt, published_at FROM articles WHERE source_id=${id}`;
    assert.equal(articles.length, 2);
    assert.ok(articles.every(r => r.published_at && r.excerpt));
    assert.equal((await sql`SELECT count(*)::int AS n FROM analyses WHERE article_id IN (SELECT id FROM articles WHERE source_id=${id})`)[0]!.n, 0);
    const before = (await sql`SELECT count(*)::int AS n FROM receipts`)[0]!.n;
    const response = await app.inject({url: "/api/site/source-items?sourceId=" + id + "&limit=1"});
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.items.length, 1); assert.equal(body.hasMore, true);
    assert.equal(body.items[0].verificationStatus, "unverified");
    assert.equal(body.items[0].selected, false);
    assert.match(body.items[0].sourceSummary, /^Source excerpt/);
    assert.equal(body.items[0].summary, undefined);
    const second = (await app.inject({url: "/api/site/source-items?sourceId=" + id + "&limit=1&page=2"})).json();
    assert.notEqual(second.items[0].id, body.items[0].id);
    const search = (await app.inject({url: "/api/site/source-items?sourceId=" + id + "&q=Fixture"})).json();
    assert.equal(search.items.length, 2);
    assert.equal((await app.inject({url: "/api/site/source-items?sourceId=" + id + "&q=absent"})).json().items.length, 0);
    assert.equal((await app.inject({url:"/api/site/source-items?page=1.5"})).statusCode,400);
    assert.equal((await app.inject({url:"/api/site/source-items?limit=41"})).statusCode,400);
    assert.equal((await app.inject({url:"/api/site/source-items?extra=yes"})).statusCode,400);
    const articleId = body.items[0].id;
    await sql`INSERT INTO editorial_overrides (article_id,fields,visibility) VALUES (${articleId}, '{}'::jsonb, 'withdrawn')`;
    await publishArticle(articleId);
    const remaining = (await app.inject({url: "/api/site/source-items?sourceId=" + id})).json();
    assert.equal(remaining.items.length,1);
    assert.notEqual(remaining.items[0].id,articleId);
    await app.inject({url:"/api/site/pool?q=Fixture"});
    await app.inject({url:"/api/site/timeline"});
    await app.inject({url:"/api/v1/items?mode=all"});
    assert.equal((await sql`SELECT count(*)::int AS n FROM receipts`)[0]!.n,before);
    await assert.rejects(chatJson({model:"default",purpose:"off-valve",subject:id,promptVersion:"1",system:"",user:"",schema:z.object({})}), /disabled/);
    assert.equal((await sql`SELECT count(*)::int AS n FROM receipts`)[0]!.n,before);
    config.allowPrivateNetworkFetch = false;
    for (const url of ["http://127.0.0.1:43184", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd"]) await assert.rejects(assertPublicUrl(url, false));
  } finally {
    config.allowPrivateNetworkFetch = false;
    await new Promise<void>(resolve => feed.close(() => resolve()));
  }
});

test("real password session, CSRF, redacted failures, and logout revocation", async () => {
  assert.equal((await app.inject({url:"/api/admin/me"})).statusCode,401);
  const login = await app.inject({method:"POST",url:"/api/auth/password",headers:{"content-type":"application/x-www-form-urlencoded"},payload:new URLSearchParams({password:process.env.ADMIN_PASSWORD!,return:"/admin"}).toString()});
  assert.equal(login.statusCode,303);
  const setCookie = String(login.headers["set-cookie"]);
  assert.match(setCookie,/HttpOnly/i);
  const cookie = setCookie.split(";")[0]!;
  const me = await app.inject({url:"/api/admin/me",headers:{cookie}});
  assert.equal(me.statusCode,200);
  assert.equal(me.json().dev,false);
  assert.equal((await app.inject({method:"POST",url:"/api/admin/sources",headers:{cookie},payload:{}})).statusCode,403);
  assert.equal((await app.inject({method:"POST",url:"/api/admin/sources",headers:{cookie,"x-csrf-token":me.json().csrf},payload:{}})).statusCode,400);
  const failed = await app.inject({url:"/api/admin/acceptance-failure",headers:{cookie}});
  assert.equal(failed.statusCode,500);
  assert.ok(!failed.body.includes("sensitive-database-diagnostic"));
  await app.inject({method:"POST",url:"/api/auth/logout",headers:{cookie,"content-type":"application/x-www-form-urlencoded"},payload:""});
  assert.equal((await app.inject({url:"/api/admin/me",headers:{cookie}})).statusCode,401);
});


test("HTTP SSR, password session, CSRF, withdrawal and cache stay consistent with models off", async () => {
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  // The fixture is isolated in *_test, separate from the live RSS smoke.
  const { upsertMaterial } = await import("@aihot/backend/content/materials");
  const source = "http-smoke-" + randomBytes(6).toString("hex");
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode) VALUES (${source},'HTTP test fixture','rss','T1','editorial')`;
  const { articleId } = await upsertMaterial({ sourceId: source, url: "https://example.org/" + source, title: "HTTP isolated source fixture", excerpt: "Synthetic source text", via: "fetch", publishedAt: new Date(Date.now() - 3600_000) });
  const web = spawn(process.execPath, ["apps/web/server.ts"], {
    env: { NODE_ENV: "production", WEB_HOST: "127.0.0.1", WEB_PORT: "0", API_BASE_URL: origin, SITE_URL: "http://127.0.0.1:0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  web.stderr.resume();
  try {
    const webOrigin = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("SSR HTTP startup timed out")), 10000);
      web.once("exit", () => { clearTimeout(timer); reject(new Error("SSR exited")); });
      createInterface({ input: web.stdout }).on("line", line => {
        const row = JSON.parse(line);
        if (row.msg === "web started") { clearTimeout(timer); resolve("http://127.0.0.1:" + row.port); }
      });
    });
    const read = (path: string, init?: RequestInit) => fetch(webOrigin + path, { redirect: "manual", signal: AbortSignal.timeout(15000), ...init });
    const before = (await sql`SELECT count(*)::int AS n FROM receipts`)[0]!.n;
    const path = "/api/site/source-items?sourceId=" + source;
    const listing = await read(path);
    assert.equal(listing.status, 200);
    const etag = listing.headers.get("etag")!;
    assert.equal((await read(path, { headers: { "if-none-match": etag } })).status, 304);
    assert.equal((await read("/api/admin/me")).status, 401);
    const login = await read("/api/auth/password", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ password: process.env.ADMIN_PASSWORD!, return: "/admin" }) });
    assert.equal(login.status, 303);
    assert.match(login.headers.get("set-cookie")!, /HttpOnly/i);
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const me = await (await read("/api/admin/me", { headers: { cookie } })).json() as { csrf: string; dev: boolean };
    assert.equal(me.dev, false);
    const mutation = "/api/admin/content/" + articleId + "/visibility";
    const body = JSON.stringify({ visibility: "withdrawn", reason: "isolated HTTP smoke", version: 0 });
    assert.equal((await read(mutation, { method: "POST", headers: { cookie, "content-type": "application/json" }, body })).status, 403);
    assert.equal((await read("/items/" + articleId)).status, 200);
    assert.match(await (await read("/source-news?sourceId=" + source)).text(), /HTTP isolated source fixture/);
    assert.equal((await read(mutation, { method: "POST", headers: { cookie, "content-type": "application/json", "x-csrf-token": me.csrf }, body })).status, 200);
    const changed = await read(path, { headers: { "if-none-match": etag } });
    assert.equal(changed.status, 200);
    assert.equal(((await changed.json()) as { items: unknown[] }).items.length, 0);
    const withdrawn = await read("/items/" + articleId);
    assert.equal(withdrawn.status, 404);
    assert.match(withdrawn.headers.get("cache-control")!, /no-store/);
    const page = await read("/source-news?sourceId=" + source);
    assert.equal(page.status, 200);
    assert.doesNotMatch(await page.text(), /HTTP isolated source fixture/);
    assert.equal((await read("/api/auth/logout", { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: "" })).status, 303);
    assert.equal((await read("/api/admin/me", { headers: { cookie } })).status, 401);
    assert.equal((await sql`SELECT count(*)::int AS n FROM receipts`)[0]!.n, before);
  } finally {
    if (web.exitCode === null) { web.kill("SIGTERM"); await once(web, "exit"); }
  }
});
