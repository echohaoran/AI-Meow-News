import { fileURLToPath } from "node:url";
import type { ServerModule } from "@aihot/backend/modules";
import { sendFile } from "../../apps/api/src/routes/static.ts";

const shared = "../openrouter-rankings/web/marks/";
const own = "../../site/brand/companies/";
const files: Record<string, string> = {
  openai: `${shared}openai.svg`,
  anthropic: `${shared}anthropic.svg`,
  google: `${shared}google-color.svg`,
  deepseek: `${shared}deepseek-color.svg`,
  qwen: `${shared}qwen-color.svg`,
  kimi: `${shared}moonshot.svg`,
  minimax: `${shared}minimax-color.svg`,
  zhipu: `${shared}zai.svg`,
  xai: `${shared}xai.svg`,
  meta: `${shared}meta-color.svg`,
  microsoft: `${shared}microsoft-color.svg`,
  nvidia: `${shared}nvidia-color.svg`,
  "hugging-face": `${own}huggingface-color.svg`,
  cursor: `${own}cursor.svg`,
  openrouter: `${own}openrouter.svg`,
};

export default {
  name: "company-marks",
  topics: {
    async marks() {
      return Object.fromEntries(Object.keys(files).map((slug) => [slug, {
        src: `/api/site/topic-marks/${slug}`, monogram: slug.slice(0, 1).toUpperCase(), raster: false,
      }]));
    },
  },
  http(app) {
    app.get<{ Params: { slug: string } }>("/api/site/topic-marks/:slug", (request, reply) => {
      const slug = request.params.slug;
      if (!Object.hasOwn(files, slug)) return reply.code(404).send();
      return sendFile(request, reply, fileURLToPath(new URL(files[slug]!, import.meta.url)), {
        cacheControl: "public, max-age=86400",
      });
    });
  },
} satisfies ServerModule;
