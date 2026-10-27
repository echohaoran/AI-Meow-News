import type { ServerModule } from "@aihot/backend/modules";
import { readReading, composePendingReadings } from "./backend/reading.ts";

export default {
  name: "chinese-reading",
  itemReading: readReading,
  schedules: [{ name: "reading.compose", cron: "*/5 * * * *", when: () => process.env.MODEL_CALLS_ENABLED === "true", run: () => composePendingReadings() }],
} satisfies ServerModule;
