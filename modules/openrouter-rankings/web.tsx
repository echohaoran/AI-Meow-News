import type { WebModule } from "../../apps/web/app/modules.ts";
import { IconChart } from "../../apps/web/app/components/icons.tsx";

export default {
  name: "openrouter-rankings",
  sidebar: { section: "内容", items: [{ to: "/rankings", label: "模型榜单", icon: IconChart }] },
  tools: [{ to: "/rankings", label: "模型榜单", icon: <IconChart size={20} /> }],
} satisfies WebModule;
