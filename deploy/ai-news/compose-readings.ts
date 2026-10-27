// Explicit backfill through the same model route, receipts and budget as the scheduled reader task.
import assert from "node:assert/strict";
import { composeReading } from "../../modules/chinese-reading/backend/reading.ts";
import { closeDb } from "@aihot/backend/db";
import { failureKind } from "@aihot/backend/providers/receipts";

try {
  assert.equal(process.env.MODEL_CALLS_ENABLED,"true");
  const ids=[...new Set(process.argv.slice(2))];
  assert.ok(ids.length>0 && ids.every(id=>/^[a-z0-9]{1,80}$/.test(id)));
  for(const id of ids) {
    try { console.log(JSON.stringify(await composeReading(id))); }
    catch(error) {
      const kind=failureKind(error);
      console.log(JSON.stringify({articleId:id,status:"deferred",kind}));
      if(["budget","off","outage"].includes(kind))throw error;
    }
  }
} catch {
  console.error("Chinese reading backfill stopped; inspect receipts before resuming");
  process.exitCode=1;
} finally { await closeDb(); }
