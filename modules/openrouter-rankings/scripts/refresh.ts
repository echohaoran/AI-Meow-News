// Explicit worker-side first fetch; normal updates use cron.openrouter.rankings.
import { refreshRankings } from "../backend/collect.ts";
import { closeDb } from "@aihot/backend/db";

try { console.log(JSON.stringify(await refreshRankings())); }
finally { await closeDb(); }
