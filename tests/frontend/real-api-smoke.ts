// Bounded real HTTP/SSR check on homelab. No database, fixtures or model calls.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import type { TimelineResponse, PoolResponse, SiteItemDetail, SourceItemsResponse } from "@aihot/contracts/site";

const api = process.env.API_BASE_URL ?? "http://127.0.0.1:43182";
assert.equal(new URL(api).hostname, "127.0.0.1");
const evidence = process.env.FRONTEND_EVIDENCE_DIR;
assert.ok(evidence, "Set FRONTEND_EVIDENCE_DIR outside source.");
await mkdir(evidence, { recursive: true });
const records: Array<Record<string, unknown>> = [];
async function read<T>(path: string): Promise<T> {
  const response = await fetch(api + path, { signal: AbortSignal.timeout(8000) });
  assert.equal(response.status, 200, path + ": HTTP " + response.status);
  records.push({ apiPath: path, status: response.status });
  return await response.json() as T;
}
let available = false;
let timeline: TimelineResponse | null = null;
let pool: PoolResponse | null = null;
let sources: SourceItemsResponse | null = null;
try {
  const health = await read<{ ok: boolean; db: string }>("/api/health");
  assert.equal(health.ok, true); assert.equal(health.db, "ok");
  timeline = await read<TimelineResponse>("/api/site/timeline");
  assert.ok(Array.isArray(timeline.cards));
  pool = await read<PoolResponse>("/api/site/pool");
  assert.ok(Array.isArray(pool.items));
  sources = await read<SourceItemsResponse>("/api/site/source-items");
  assert.ok(sources.items.length > 0, "Require real source material");
  available = true;
} catch (error) {
  records.push({ realApiReady: false, reason: error instanceof Error ? error.message : String(error) });
}
const web = spawn(process.execPath, ["apps/web/server.ts"], {
  env: { NODE_ENV: "production", WEB_HOST: "127.0.0.1", WEB_PORT: "43181", API_BASE_URL: api, SITE_URL: "http://192.168.1.77:43180" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverErrors = "";
web.stderr.on("data", chunk => { serverErrors += String(chunk); });
try {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("web startup timed out")), 8000);
    web.once("exit", code => { clearTimeout(timeout); reject(new Error("web startup exit " + code)); });
    createInterface({ input: web.stdout }).on("line", line => {
      try { if (JSON.parse(line).msg === "web started") { clearTimeout(timeout); resolve(); } } catch {}
    });
  });
  async function render(path: string, expected: number, name: string) {
    const response = await fetch("http://127.0.0.1:43181" + path, { signal: AbortSignal.timeout(20000), redirect: "manual" });
    const html = await response.text();
    await writeFile(evidence + "/" + name + ".html", html);
    assert.equal(response.status, expected, "SSR " + path);
    const $ = cheerio.load(html);
    records.push({ page: path, status: response.status, title: $("title").text(), mainText: $("#main").text().trim().slice(0, 700) });
    return $;
  }
  const home = await render("/", available ? 200 : 503, "home");
  assert.match(home("#main").text(), /AI-News/);
  if (available) {
    if (timeline!.cards.length === 0) {
      const preview = home('[aria-label="来源新闻"]');
      assert.ok(preview.text().includes(sources!.items[0]!.title));
      assert.match(preview.text(), /尚未经独立事实核验/);
    } else assert.ok(home('#main a[href^="/items/"]').length > 0);
    for (const [path, name] of [["/all", "all"], ["/all?q=AI", "search"], ["/all?category=ai-models", "category"], ["/hot", "hot"], ["/daily", "daily"]]) await render(path!, 200, name!);
    const sourcePage = await render("/source-news", 200, "sources");
    assert.match(sourcePage("#main").text(), /来源动态·未核验/);
    for (const item of sources!.items) {
      assert.ok(sourcePage("#main").text().includes(item.title));
      assert.ok(sourcePage(`time[datetime="${item.publishedAt}"]`).length > 0);
      assert.ok(sourcePage(`a[href="${item.links.original}"]`).length > 0);
      assert.equal(item.selected, false);
      assert.equal(item.verificationStatus, "unverified");
    }
    const original = sources!.items[0]!;
    const sourceHref = sourcePage("#main a").filter((_, node) => sourcePage(node).text().trim() === original.source.name).first().attr("href");
    assert.ok(sourceHref, "The source name must be a usable filter link");
    const sourceTarget = new URL(sourceHref, "http://127.0.0.1:43181");
    assert.equal(sourceTarget.searchParams.get("sourceId"), original.source.id);
    const sourceFiltered = await render(sourceTarget.pathname + sourceTarget.search, 200, "source-link");
    assert.match(sourceFiltered("#main").text(), /来源动态·未核验/);
    assert.ok(sourceFiltered("#main").text().includes(original.title));
    const query = original.title.split(/\s+/).find(t => t.length >= 3) ?? original.title.slice(0, 3);
    const searchPath = "/source-news?" + new URLSearchParams({ q: query, sourceId: original.source.id });
    const filtered = await render(searchPath, 200, "source-search");
    assert.ok(filtered("#main").text().includes(original.title));
    const absent = await render("/source-news?q=NO_MATCH_7a613847", 200, "source-empty");
    assert.match(absent("#main").text(), /暂无匹配/);
    await render("/source-news?q=x", 400, "source-invalid");
    await render("/items/does-not-exist-7a613847", 404, "detail-404");
    const id = original.id;
    if (id) {
      const detail = await read<SiteItemDetail>("/api/site/items/" + encodeURIComponent(id));
      const article = await render("/items/" + encodeURIComponent(id), 200, "item");
      assert.ok(article("#main").text().includes(detail.title));
      records.push({ actualItemDetailVerified: true, originalAvailable: !!detail.links.original });
    } else {
      records.push({ actualItemDetailVerified: false, reason: "Real publication has no item; no fixture inserted." });
    }
  } else {
    assert.match(home("#main").text(), /暂时无法加载/);
  }
  await render("/terms", 200, "terms");
  await render("/privacy", 200, "privacy");
} finally {
  if (web.exitCode === null) { web.kill("SIGTERM"); await once(web, "exit"); }
  await writeFile(evidence + "/real-api-summary.json", JSON.stringify({ available, timelineCount: timeline?.cards.length ?? null, poolCount: pool?.items.length ?? null, sourceCount: sources?.items.length ?? null, records }, null, 2));
  await writeFile(evidence + "/ssr-server.log", serverErrors);
}
console.log(JSON.stringify({ realApiAvailable: available, recordCount: records.length }));
if (!available) process.exitCode = 2;
