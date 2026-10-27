import type { ServerModule } from "@aihot/backend/modules";
import { loadPublicSnapshot } from "@aihot/backend/publication/snapshots";
import { sendJsonWithEtag } from "../../apps/api/src/http/respond.ts";
import { refreshRankings } from "./backend/collect.ts";
import type { RankingsSnapshot } from "./contracts.ts";

export default {
  name: "openrouter-rankings",
  http(app) {
    app.get("/api/site/rankings", async (request, reply) => {
      const snapshot = await loadPublicSnapshot<RankingsSnapshot>("openrouter-rankings");
      return sendJsonWithEtag(request, reply, snapshot ?? { checkedAt: null, boards: [], failures: [] }, { etagPrefix: "rankings", cacheControl: "public, max-age=300, s-maxage=300" });
    });
  },
  schedules: [{ name: "openrouter.rankings", cron: "15 8 * * *", missed: "once", when: () => process.env.COLLECT_ENABLED === "true", run: refreshRankings }],
} satisfies ServerModule;
