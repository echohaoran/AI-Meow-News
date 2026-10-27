// Backfill explicit article ids with the worker's normal translation receipts and budgets.
import assert from "node:assert/strict";
import { sql, closeDb } from "@aihot/backend/db";
import { translateArticle } from "@aihot/backend/editorial/translate";
import { failureKind } from "@aihot/backend/providers/receipts";

try {
  assert.equal(process.env.MODEL_CALLS_ENABLED, "true");
  const ids = [...new Set(process.argv.slice(2))];
  assert.ok(ids.length > 0 && ids.every(id => /^[a-z0-9]{1,80}$/.test(id)));
  for (const id of ids) {
    const [current] = await sql`SELECT 1 FROM translations tr JOIN articles a ON a.id=tr.article_id
      WHERE tr.article_id=${id} AND tr.lang='zh' AND tr.revision>=a.revision AND tr.complete`;
    if (current) { console.log(JSON.stringify({ articleId: id, status: "existing" })); continue; }
    try { console.log(JSON.stringify(await translateArticle(id))); }
    catch (error) {
      const kind = failureKind(error);
      console.log(JSON.stringify({ articleId: id, status: "deferred", kind }));
      if (["budget", "off", "outage"].includes(kind)) throw error;
    }
  }
} catch {
  console.error("Translation backfill stopped; inspect receipts before resuming");
  process.exitCode = 1;
} finally { await closeDb(); }
