// What the site's modules add to the web pages (site/modules/index.ts).
import type { WebModule } from "@aihot/web/modules";
import rankings from "@aihot/openrouter-rankings/web";

export const WEB_MODULES: readonly WebModule[] = [rankings];
