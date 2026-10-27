import "../../../tests/standalone.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import Fastify from "fastify";
import marks from "../server.ts";

const app = Fastify();
marks.http(app);
after(() => app.close());

test("every configured company topic has a locally served SVG logo", async () => {
  const topics = JSON.parse(readFileSync(new URL("../../../industry/topics.json", import.meta.url), "utf8"));
  const brands = await marks.topics.marks();
  for (const topic of topics.topics.filter((t: { group: string }) => t.group === "company")) {
    const brand = brands[topic.slug];
    assert.ok(brand?.src, topic.slug);
    const response = await app.inject({ method: "GET", url: brand.src });
    assert.equal(response.statusCode, 200, topic.slug);
    assert.match(response.headers["content-type"] ?? "", /image\/svg\+xml/);
    assert.match(response.body, /<svg\b/);
  }
});

test("logo files support validators and only configured topic names resolve", async () => {
  const first = await app.inject({ method: "GET", url: "/api/site/topic-marks/openai" });
  const cached = await app.inject({ method: "GET", url: "/api/site/topic-marks/openai", headers: { "if-none-match": first.headers.etag! } });
  assert.equal(cached.statusCode, 304);
  for (const slug of ["unknown", "constructor"]) {
    assert.equal((await app.inject({ method: "GET", url: `/api/site/topic-marks/${slug}` })).statusCode, 404);
  }
});
