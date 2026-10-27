import assert from "node:assert/strict";
import { test } from "node:test";
import { parseApps, parseBenchmarks, parseCatalog, parseModels } from "../backend/parse.ts";
import { collectSnapshot, refreshRankings } from "../backend/collect.ts";

const AT = "2026-10-27T00:15:00.000Z";
const catalog = { data: [{ permaslug: "lab/a-20261001", slug: "lab/a", short_name: "Model A", author: "lab" }, { permaslug: "lab/b-20261001", slug: "lab/b", short_name: "Model B", author: "lab" }] };
const names = parseCatalog(catalog);
const usage = (extra: Record<string, unknown> = {}) => ({ date: "2026-10-26 00:00:00", model_permaslug: "lab/a-20261001", variant: "standard", total_prompt_tokens: 100, total_completion_tokens: 50, image_output_requests: 4, count: 1000, change: 0.2, ...extra });
const apps = { data: { day: [{ app: { title: "App A", slug: "app-a" }, total_tokens: "90" }], week: [{ app: { title: "App A", slug: "app-a" }, total_tokens: "200" }], month: [{ app: { title: "App A", slug: "app-a" }, total_tokens: "500" }] } };
const benchmarks = { data: { aaData: { intelligence: [{ permaslug: "lab/a-20261001", aa_name: "Model A", score: 52.5 }] }, daData: { "models-website": [{ permaslug: "lab/b-20261001", display_name: "Model B", score: 1450 }] } } };

test("token and image rankings use the source's different metrics and keep free variants separate", () => {
  const data = [usage(), usage({ model_permaslug: "lab/b-20261001", total_prompt_tokens: 10, total_completion_tokens: 5, image_output_requests: 20, count: 1 }), usage({ variant: "free", variant_permaslug: "lab/a-20261001:free", total_prompt_tokens: 1, total_completion_tokens: 1 })];
  const text = parseModels({ data }, "text", "week", names, AT);
  const image = parseModels({ data }, "image", "week", names, AT);
  assert.equal(text.entries[0].name, "Model A");
  assert.equal(text.entries[0].value, "150");
  assert.equal(image.entries[0].name, "Model B");
  assert.equal(image.entries[0].value, "20");
  assert.equal(text.entries[2].url, "https://openrouter.ai/lab/a:free");
  assert.equal(text.asOf, "2026-10-26");
  assert.equal(text.fetchedAt, AT);
});

test("missing metrics and unsafe JSON integers fail; exact 64-bit strings retain their order", () => {
  assert.throws(() => parseModels({ data: [usage({ total_prompt_tokens: undefined })] }, "text", "day", names, AT));
  assert.throws(() => parseModels({ data: [usage({ count: Number.MAX_SAFE_INTEGER + 1 })] }, "video", "day", names, AT));
  const board = parseModels({ data: [usage({ total_prompt_tokens: "9007199254740993", total_completion_tokens: "0" }), usage({ model_permaslug: "lab/b-20261001", total_prompt_tokens: "9007199254740992", total_completion_tokens: "0" })] }, "text", "day", names, AT);
  assert.equal(board.entries[0].value, "9007199254740993");
  assert.equal(board.entries[1].value, "9007199254740992");
  assert.throws(() => parseModels({ data: [] }, "text", "week", names, AT));
});

test("catalog variants sharing a permaslug cannot rename the standard model or double the variant suffix", () => {
  const names = parseCatalog({ data: [...catalog.data, { permaslug: "lab/a-20261001", slug: "lab/a", short_name: "Model A (batch)", author: "lab", endpoint: { variant: "batch" } }] });
  const board = parseModels({ data: [usage(), usage({ variant: "batch" })] }, "text", "week", names, AT);
  assert.deepEqual(board.entries.map((e) => [e.name, e.url]), [["Model A", "https://openrouter.ai/lab/a"], ["Model A (batch)", "https://openrouter.ai/lab/a:batch"]]);
});

test("growth keeps missing comparison data distinct from zero; old last-seen dates are not dropped", () => {
  const board = parseModels({ data: [usage({ change: 0 }), usage({ model_permaslug: "lab/b-20261001", change: null })] }, "text", "trending", names, AT);
  assert.deepEqual(board.entries.map((e) => [e.name, e.change]), [["Model B", null]]);
  const week = parseModels({ data: [usage(), usage({ model_permaslug: "lab/b-20261001", date: "2026-10-25 00:00:00" }), usage({ model_permaslug: "", total_prompt_tokens: 0, total_completion_tokens: 0 })] }, "text", "week", names, AT);
  assert.equal(week.entries.length, 2);
  assert.equal(week.asOf, "2026-10-26");
});

test("apps use token volume while benchmark sources retain separate score scales", () => {
  assert.equal(parseApps(apps, AT)[1].entries[0].value, "200");
  const boards = parseBenchmarks(benchmarks, names, AT);
  assert.deepEqual(boards.map((b) => [b.unit, b.entries[0].value]), [["分数", "52.5"], ["ELO", "1450"]]);
});

test("a partial upstream failure preserves the old board and its original fetch timestamp", async () => {
  const old = parseModels({ data: [usage()] }, "image", "week", names, "2026-10-26T00:15:00.000Z");
  const requests: string[] = [];
  const result = await collectSnapshot(async (path) => {
    requests.push(path);
    if (path === "catalog/models") return catalog;
    if (path === "rankings/apps") return apps;
    if (path === "rankings/benchmarks") return benchmarks;
    if (path === "rankings/modality-models?routeSegment=image&view=week") throw new Error("HTTP 503");
    return { data: [usage()] };
  }, { checkedAt: old.fetchedAt, boards: [old], failures: [] }, new Date(AT));
  assert.equal(requests.length, 39);
  assert.deepEqual(result.boards.find((b) => b.id === old.id), old);
  assert.deepEqual(result.failures.map((f) => f.id), ["image:week"]);
  assert.equal(result.checkedAt, AT);
  assert.ok(result.boards.some((b) => b.id === "transcription:day"));
});

test("the closed collection valve does not access the database or upstream", async () => {
  const previous = process.env.COLLECT_ENABLED;
  process.env.COLLECT_ENABLED = "false";
  try { assert.deepEqual(await refreshRankings(), { skipped: "collection disabled" }); }
  finally {
    if (previous === undefined) delete process.env.COLLECT_ENABLED;
    else process.env.COLLECT_ENABLED = previous;
  }
});
