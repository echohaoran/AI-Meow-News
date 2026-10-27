import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "openrouter-rankings",
  pages: [{ path: "rankings", file: "web/page.tsx" }],
  apiPaths: [/^\/api\/site\/rankings$/],
});
