import { z } from "zod";
import { CATEGORIES, type Period, type RankingBoard, type RankingEntry } from "../contracts.ts";

const Records = z.object({ data: z.array(z.record(z.string(), z.unknown())) });
const Model = z.object({ permaslug: z.string(), slug: z.string(), short_name: z.string(), author: z.string(),
  endpoint: z.object({ variant: z.string() }).nullable().optional() });
export type ModelNames = Map<string, z.infer<typeof Model>>;

export function parseCatalog(input: unknown): ModelNames {
  const { data } = z.object({ data: z.array(Model) }).parse(input);
  if (!data.length) throw new Error("Empty OpenRouter model catalog");
  const names: ModelNames = new Map();
  for (const model of data) {
    const variant = model.endpoint?.variant && model.endpoint.variant !== "standard" ? model.endpoint.variant : /:([^/]+)$/.exec(model.slug)?.[1];
    names.set(model.permaslug + (variant ? `:${variant}` : ""), model);
  }
  return names;
}

/** No missing metric becomes zero, and no 64-bit integer is silently rounded. */
function integer(value: unknown): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new Error("Invalid OpenRouter usage metric");
}

const link = (path: string) => /^\/?[a-zA-Z0-9:_./-]+$/.test(path) ? `https://openrouter.ai/${path.replace(/^\//, "")}` : null;
const compare = (a: RankingEntry, b: RankingEntry) => BigInt(a.value) > BigInt(b.value) ? -1 : BigInt(a.value) < BigInt(b.value) ? 1 : a.name.localeCompare(b.name);

export function parseModels(input: unknown, category: string, period: Period, names: ModelNames, fetchedAt: string): RankingBoard {
  const config = CATEGORIES.find((c) => c.id === category);
  if (!config || category === "benchmarks" || category === "apps") throw new Error("Unknown model ranking category");
  const { data } = Records.parse(input);
  // An empty upstream result is different from a successful zero-usage ranking.
  if (!data.length) throw new Error("Empty OpenRouter model ranking");
  const seen = new Set<string>();
  const dates = new Set<string>();
  const entries: RankingEntry[] = [];
  for (const row of data) {
    const amount = category === "text" ? integer(row.total_prompt_tokens) + integer(row.total_completion_tokens)
      : integer(row[category === "image" ? "image_output_requests" : "count"]);
    // The source includes a zero-volume anonymous bucket, which is not a ranked model.
    if (amount === 0n) continue;
    const slug = z.string().min(1).parse(row.model_permaslug);
    const variant = typeof row.variant === "string" && row.variant !== "standard" ? row.variant : null;
    const key = typeof row.variant_permaslug === "string" ? row.variant_permaslug : slug + (variant ? `:${variant}` : "");
    if (seen.has(key)) throw new Error("Duplicate OpenRouter model variant");
    seen.add(key);
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}(?: |T)/).parse(row.date).slice(0, 10);
    dates.add(date);
    const change = row.change === null || row.change === undefined ? null : z.number().finite().parse(row.change);
    if (period === "trending" && change !== null && change <= 0) continue;
    const model = names.get(key) ?? names.get(slug + (variant ? `:${variant}` : "")) ?? names.get(slug);
    const name = model?.short_name ?? slug;
    const suffix = variant && !name.toLowerCase().endsWith(`(${variant.toLowerCase()})`) ? ` (${variant})` : "";
    const target = model?.slug ?? slug;
    entries.push({ rank: 0, name: name + suffix, author: model?.author ?? slug.split("/")[0],
      url: link(target + (variant && !target.endsWith(`:${variant}`) ? `:${variant}` : "")), value: amount.toString(), change });
  }
  // Each model is already aggregated for the requested window; inactive models may have older last-seen dates.
  entries.sort(period === "trending" ? (a, b) => {
    if (a.change === null && b.change !== null) return -1;
    if (a.change !== null && b.change === null) return 1;
    return (b.change ?? 0) - (a.change ?? 0) || compare(a, b);
  } : compare);
  return { id: `${category}:${period}`, category, title: `${config.label}模型使用排行榜`, period, unit: config.unit,
    sourceUrl: `https://openrouter.ai/rankings${category === "text" ? "" : `/${category}`}`,
    asOf: [...dates].sort().at(-1) ?? null, fetchedAt, entries: entries.slice(0, 50).map((entry, i) => ({ ...entry, rank: i + 1 })) };
}

export function parseApps(input: unknown, fetchedAt: string): RankingBoard[] {
  const { data } = z.object({ data: z.object({ day: z.array(z.record(z.string(), z.unknown())), week: z.array(z.record(z.string(), z.unknown())), month: z.array(z.record(z.string(), z.unknown())) }) }).parse(input);
  return (["day", "week", "month"] as const).map((period) => {
    if (!data[period].length) throw new Error("Empty OpenRouter app ranking");
    const entries = data[period].map((row): RankingEntry => {
      const app = z.object({ title: z.string(), slug: z.string().nullable().optional() }).parse(row.app);
      return { rank: 0, name: app.title, author: "", url: app.slug ? link(`apps/${app.slug}`) : null, value: integer(row.total_tokens).toString(), change: null };
    }).sort(compare).slice(0, 50).map((entry, i) => ({ ...entry, rank: i + 1 }));
    return { id: `apps:${period}`, category: "apps", title: "应用使用排行榜", period, unit: "tokens", sourceUrl: "https://openrouter.ai/rankings#apps", asOf: null, fetchedAt, entries };
  });
}

export function parseBenchmarks(input: unknown, names: ModelNames, fetchedAt: string): RankingBoard[] {
  const { data } = z.object({ data: z.object({ aaData: z.record(z.string(), z.unknown()), daData: z.record(z.string(), z.unknown()) }) }).parse(input);
  const boards: RankingBoard[] = [];
  for (const [source, metrics] of [["Artificial Analysis", data.aaData], ["Design Arena", data.daData]] as const) {
    for (const [key, values] of Object.entries(metrics)) {
      if (!Array.isArray(values) || !values.length) continue;
      const entries = values.map((row): RankingEntry => {
        const r = z.object({ permaslug: z.string().nullable().optional(), aa_name: z.string().optional(), display_name: z.string().optional(), score: z.number().finite() }).parse(row);
        const model = r.permaslug ? names.get(r.permaslug) : undefined;
        const name = r.aa_name ?? r.display_name;
        if (!name) throw new Error("Missing OpenRouter benchmark model name");
        return { rank: 0, name, author: model?.author ?? r.permaslug?.split("/")[0] ?? "", url: model ? link(model.slug) : null, value: String(r.score), change: null };
      }).sort((a, b) => Number(b.value) - Number(a.value) || a.name.localeCompare(b.name)).slice(0, 50).map((entry, i) => ({ ...entry, rank: i + 1 }));
      boards.push({ id: `benchmarks:${source}:${key}`, category: "benchmarks", title: `${source} · ${key}`, period: "benchmark", unit: source === "Design Arena" ? "ELO" : "分数",
        sourceUrl: "https://openrouter.ai/rankings#benchmarks", asOf: null, fetchedAt, entries });
    }
  }
  if (!boards.length) throw new Error("Empty OpenRouter benchmarks");
  return boards;
}
