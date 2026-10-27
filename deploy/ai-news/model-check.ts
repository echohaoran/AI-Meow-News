// Independent bounded real-model acceptance, never imported by readers or unit tests.
import assert from "node:assert/strict";
import { z } from "zod";
import { chatJson } from "@aihot/backend/providers/llm";
import { sql, closeDb } from "@aihot/backend/db";
import { completeReceipt } from "@aihot/backend/providers/receipts";

try {
  if (process.env.MODEL_CALLS_ENABLED !== "true" || process.env.COLLECT_ENABLED !== "false") throw new Error("valves");
  // Reusing this explicit acceptance identity verifies persisted paid-request reuse.
  const options = {
    model: "default", purpose: "ainews-connectivity-acceptance", subject: "ainews-backend-20261026",
    promptVersion: "2", system: "Return only the requested json object.",
    user: 'Return valid json {"ok":true}. This is a connection check, not a news verification.',
    schema: z.object({ ok: z.literal(true) }), temperature: 0, maxTokens: 64, timeoutMs: 45000,
  };
  const first = await chatJson(options);
  assert.equal(first.data.ok, true);
  await completeReceipt(sql, first.receiptId);
  const again = await chatJson(options);
  assert.equal(again.receiptId, first.receiptId);
  assert.equal(again.reused, true);
  console.log(JSON.stringify({ ok: true, model: process.env.LLM_MODEL, receiptId: first.receiptId, reused: again.reused, usage: first.usage, purpose: "connection-only", newsAnalyzed: 0 }));
} catch {
  console.error("Model acceptance failed; inspect provider receipt state with authenticated tooling");
  process.exitCode = 1;
} finally { await closeDb(); }
