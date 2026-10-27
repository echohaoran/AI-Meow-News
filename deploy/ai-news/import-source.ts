// Promote at most three already collected source records. No collection or model requests.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { z } from "zod";
import { sql, closeDb } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
const Item = z.object({
  id: z.string().regex(/^[a-z0-9]+$/), source_id: z.literal("rss-openai-news"),
  title: z.string().min(1), url: z.string().url().refine(u => new URL(u).hostname === "openai.com" && new URL(u).protocol === "https:"),
  excerpt: z.string().nullable(), published_at: z.iso.datetime(), discovered_at: z.iso.datetime(), publication_time: z.string().nullable(),
});
try {
  const database = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  assert.equal(database, "ainews_prod");
  assert.equal(process.env.COLLECT_ENABLED, "false");
  assert.equal(process.env.MODEL_CALLS_ENABLED, "false");
  assert.equal(process.argv.length, 3);
  const items = z.array(Item).min(1).max(3).parse(JSON.parse(readFileSync(process.argv[2]!, "utf8")));
  const [source] = await sql`SELECT kind,participation_mode FROM sources WHERE id='rss-openai-news'`;
  assert.equal(source?.kind, "rss"); assert.equal(source?.participation_mode, "editorial");
  for (const item of items) {
    const result = await upsertMaterial({ id: item.id, sourceId: item.source_id, title: item.title, url: item.url,
      excerpt: item.excerpt, publishedAt: new Date(item.published_at), discoveredAt: new Date(item.discovered_at),
      publicationTime: item.publication_time, bodyStatus: "pending", via: "import", backfill: "first-import" });
    console.log(JSON.stringify({ articleId: result.articleId, created: result.created, revised: result.revised, backfill: result.backfill }));
  }
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : "Source import refused; verify reviewed snapshot, source seed and production configuration");
  process.exitCode = 1;
} finally { await closeDb(); }
