import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import Fastify from "fastify";
import { sql, closeDb } from "@aihot/backend/db";
import { loadPublicSnapshot } from "@aihot/backend/publication/snapshots";
import { refreshRankings } from "../backend/collect.ts";
import rankings from "../server.ts";

const app = Fastify();
rankings.http(app);
after(async () => {
  await app.close();
  await sql`DELETE FROM settings WHERE key IN ('public-snapshot:openrouter-rankings', 'private-rankings-test-setting')`;
  await closeDb();
});

test("worker stores snapshots; anonymous reads use publication storage, cache validators and no outbound calls", async () => {
  const empty = await app.inject({ method: "GET", url: "/api/site/rankings" });
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.json(), { checkedAt: null, boards: [], failures: [] });
  let outbound = 0;
  const previous = process.env.COLLECT_ENABLED;
  process.env.COLLECT_ENABLED = "true";
  try {
    const result = await refreshRankings(async (path) => {
      outbound++;
      if (path === "catalog/models") return { data: [{ permaslug: "lab/model-1", slug: "lab/model", short_name: "Model", author: "lab" }] };
      if (path === "rankings/apps") return { data: Object.fromEntries(["day", "week", "month"].map((p) => [p, [{ app: { title: "App", slug: "app" }, total_tokens: "20" }]])) };
      if (path === "rankings/benchmarks") return { data: { aaData: { intelligence: [{ permaslug: "lab/model-1", aa_name: "Model", score: 55 }] }, daData: {} } };
      return { data: [{ date: "2026-10-26 00:00:00", model_permaslug: "lab/model-1", variant: "standard", count: 10, image_output_requests: 5, total_prompt_tokens: 100, total_completion_tokens: 20, change: 0.1 }] };
    });
    assert.equal(result.boards, 40);
    assert.equal(result.failed, 0);
    const count = outbound;
    const first = await app.inject({ method: "GET", url: "/api/site/rankings" });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().boards.length, 40);
    assert.equal(first.json().boards[0].entries[0].name, "Model");
    const unchanged = await app.inject({ method: "GET", url: "/api/site/rankings", headers: { "if-none-match": first.headers.etag! } });
    assert.equal(unchanged.statusCode, 304);
    assert.equal(outbound, count, "reading or revalidating the page must never fetch OpenRouter");
    await sql`INSERT INTO settings (key,value) VALUES ('private-rankings-test-setting', '{"private":true}'::jsonb)`;
    assert.equal(await loadPublicSnapshot("private-rankings-test-setting"), null);
  } finally {
    if (previous === undefined) delete process.env.COLLECT_ENABLED;
    else process.env.COLLECT_ENABLED = previous;
  }
});
