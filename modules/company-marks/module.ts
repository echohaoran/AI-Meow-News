import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "company-marks",
  apiPaths: [/^\/api\/site\/topic-marks\/[^/]+$/],
});
