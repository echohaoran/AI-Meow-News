import { Form, Link, useLoaderData, useSearchParams } from "react-router";
import { loadOr404, cachedPage } from "../../../apps/web/app/lib/api.server";
import { pageReuse } from "../../../apps/web/app/lib/page-reuse";
import { pageMeta } from "../../../apps/web/app/lib/seo";
import { PhoneBar } from "../../../apps/web/app/components/shell/PhoneBar";
import { Kicker } from "../../../apps/web/app/components/ui/Kicker";
import { IconExternal } from "../../../apps/web/app/components/icons";
import { BrandMark } from "../../../apps/web/app/components/BrandMark";
import { CATEGORIES, PERIODS, type RankingsSnapshot } from "../contracts";
import { publisherBrand } from "./brands";

export const handle = { tab: "me", name: "排行榜" };
export { pageHeaders as headers } from "../../../apps/web/app/lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>(() => "/rankings");

export async function loader({ request }: { request: Request }) {
  const upstream = new Headers();
  const snapshot = await loadOr404<RankingsSnapshot>("/api/site/rankings", { signal: request.signal, responseHeaders: upstream });
  return cachedPage(300, { snapshot }, upstream);
}

export function meta({ location }: { location: { search: string } }) {
  const category = new URLSearchParams(location.search).get("category");
  return pageMeta({ title: category === "benchmarks" ? "模型能力排行榜" : category === "apps" ? "应用使用排行榜" : "模型使用排行榜", description: "每日同步 OpenRouter 模型使用排行榜，按平台用量排序；能力基准单独展示。", path: "/rankings" });
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

function metric(value: string) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value));
}

export default function RankingsPage() {
  const { snapshot } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const category = CATEGORIES.find((c) => c.id === params.get("category"))?.id ?? "text";
  const period = PERIODS.find((p) => p.id === params.get("period"))?.id ?? "week";
  const boardId = params.get("board") ?? "";
  const available = snapshot.boards.filter((board) => board.category === category);
  const board = category === "benchmarks" ? available.find((b) => b.id === boardId) ?? available[0]
    : available.find((b) => b.period === period);
  const config = CATEGORIES.find((c) => c.id === category)!;
  const pageTitle = category === "benchmarks" ? "模型能力排行榜" : category === "apps" ? "应用使用排行榜" : "模型使用排行榜";
  const boardTitle = category === "benchmarks" ? "能力基准排行榜" : category === "apps" ? "应用使用排行榜" : `${config.label}模型使用排行榜`;
  const incomplete = snapshot.failures.some((failure) => failure.id === board?.id || failure.id === category);
  const href = (cat: string, per = period) => `/rankings?${new URLSearchParams({ category: cat, period: per })}`;
  const largest = Math.max(0, ...(board?.entries.map((entry) => Number(entry.value)) ?? []));

  return (
    <div className="mx-auto max-w-[1280px] pb-12">
      <PhoneBar back={{ to: "/more", label: "我的" }} title={pageTitle} />
      <header className="border-b border-line pb-7 pt-4 lg:pt-2">
        <Kicker>OpenRouter · 每日快照</Kicker>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 data-page-title="" className="text-[32px] font-black tracking-tight text-ink lg:text-[42px]">{pageTitle}</h1>
            <p className="mt-3 max-w-[48em] text-[14px] leading-relaxed text-ink-3">查看各类模型的实际使用情况、能力基准与热门应用。用量仅代表 OpenRouter 平台流量，不代表全行业份额或模型能力。</p>
          </div>
          <a href="https://openrouter.ai/rankings" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[13px] text-ink-2 hover:text-accent">
            查看来源 <IconExternal size={14} />
          </a>
        </div>
        <p className="mt-4 text-[12px] text-ink-4">每天北京时间 08:15 更新 · {snapshot.checkedAt ? `最近检查 ${dateTime(snapshot.checkedAt)}` : "等待首次同步"}</p>
      </header>

      <nav aria-label="排行榜分类" className="mt-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => <Link key={c.id} to={href(c.id, c.id === "apps" && period === "trending" ? "week" : period)} aria-current={category === c.id ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-full border px-4 text-[13px] font-medium transition-colors ${category === c.id ? "border-accent bg-accent text-[var(--accent-contrast)]" : "border-line bg-surface text-ink-3 hover:border-accent hover:text-accent"}`}>
          {c.label}
        </Link>)}
      </nav>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[20px] font-bold text-ink">{boardTitle}</h2>
        {category === "benchmarks" ? available.length > 0 && (
          <Form method="get" className="flex max-w-full items-center gap-2">
            <input type="hidden" name="category" value="benchmarks" />
            <label htmlFor="ranking-benchmark" className="sr-only">能力基准</label>
            <select id="ranking-benchmark" name="board" defaultValue={board?.id} className="min-h-10 min-w-0 max-w-[260px] rounded-control border border-line bg-surface px-3 text-[13px] text-ink">
              {available.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            <button type="submit" className="min-h-10 rounded-control bg-well px-3 text-[13px] text-ink">查看</button>
          </Form>
        ) : (
          <nav aria-label="统计周期" className="flex flex-wrap gap-1 rounded-full bg-well p-1">
            {PERIODS.filter((p) => category !== "apps" || p.id !== "trending").map((p) => <Link key={p.id} to={href(category, p.id)} aria-current={period === p.id ? "page" : undefined}
              className={`rounded-full px-3 py-2 text-[12px] sm:px-4 ${period === p.id ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}>{p.label}</Link>)}
          </nav>
        )}
      </div>

      {incomplete && <p role="status" className="mt-4 rounded-control border border-line bg-well px-4 py-3 text-[13px] text-ink-2">本次同步未能更新这个榜单，以下保留最近成功获取的数据，请留意快照时间。</p>}

      {!board ? (
        <div className="mt-6 rounded-card border border-line bg-surface px-6 py-16 text-center">
          <h3 className="text-[18px] font-semibold text-ink">{snapshot.checkedAt ? "该榜单暂未同步成功" : "尚未获取榜单"}</h3>
          <p className="mt-3 text-[14px] text-ink-3">自动采集成功后会在此展示。你也可以先访问 OpenRouter 查看原始榜单。</p>
        </div>
      ) : <>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-ink-3">
          <span>快照：{dateTime(board.fetchedAt)}（北京时间）</span>
          <span>{board.asOf ? `用量数据截至 ${board.asOf}（UTC）` : "来源未提供独立数据截止时间"}</span>
          <span>指标：{board.unit} · {board.entries.length} 个条目</span>
        </div>
        {category === "text" && <p className="mt-2 text-[12px] leading-relaxed text-ink-4">用量包含输入与输出 token。不同供应商的 tokenizer 不同，数值用于观察使用规模，不宜作为能力比较。</p>}
        {period === "trending" && category !== "benchmarks" && <p className="mt-2 text-[12px] text-ink-4">按环比增长率排列；来源无可比前期数据的模型标为“新”，不将其增长率记为 0。</p>}
        <div className="mt-5 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
            <caption className="sr-only">{category === "benchmarks" ? board.title : boardTitle}，{board.unit}</caption>
            <thead className="border-b border-line bg-bg-sunk text-[12px] text-ink-3">
              <tr><th scope="col" className="w-16 px-4 py-3 font-medium">排名</th><th scope="col" className="px-3 py-3 font-medium">{category === "apps" ? "应用" : "模型"}</th><th scope="col" className="px-3 py-3 text-right font-medium">{board.unit}</th>{category !== "benchmarks" && category !== "apps" && <th scope="col" className="px-4 py-3 text-right font-medium">环比</th>}</tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {board.entries.map((entry) => <tr key={`${entry.rank}:${entry.name}`} className="hover:bg-bg-sunk">
                <td className={`num px-4 py-4 text-[16px] ${entry.rank <= 3 ? "font-black text-accent" : "text-ink-4"}`}>{String(entry.rank).padStart(2, "0")}</td>
                <td className="px-3 py-4"><div className="flex items-center gap-3">
                  {category !== "apps" && <BrandMark brand={publisherBrand(entry.author)} size={28} />}
                  <div className="min-w-0"><div className="font-semibold leading-relaxed text-ink">{entry.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">{entry.name}</a> : entry.name}</div>{entry.author && <div className="mt-0.5 text-[12px] text-ink-4">{entry.author}</div>}</div>
                </div></td>
                <td className="px-3 py-4 text-right"><span className="num font-semibold text-ink" title={entry.value}>{metric(entry.value)}</span>{category !== "benchmarks" && <div className="mt-2 ml-auto h-1 w-20 overflow-hidden rounded-full bg-well" aria-hidden="true"><div className="h-full rounded-full bg-accent/40" style={{ width: `${largest > 0 ? Number(entry.value) / largest * 100 : 0}%` }} /></div>}</td>
                {category !== "benchmarks" && category !== "apps" && <td className="num whitespace-nowrap px-4 py-4 text-right text-[13px] text-ink-3">{entry.change === null ? "新" : `${entry.change > 0 ? "+" : ""}${(entry.change * 100).toFixed(1)}%`}</td>}
              </tr>)}
            </tbody>
          </table>
        </div>
      </>}

      <footer className="mt-8 space-y-2 border-t border-line pt-5 text-[12px] leading-relaxed text-ink-4">
        <p>数据来源：<a href={board?.sourceUrl ?? "https://openrouter.ai/rankings"} target="_blank" rel="noopener noreferrer" className="text-ink-3 underline">OpenRouter Rankings</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY 4.0</a>。本站整理栏目名称与展示格式，保留原始指标和来源入口。</p>
        <p>能力基准来自 OpenRouter 汇集的 Artificial Analysis 与 Design Arena；其分数口径分别保留，不与用量合并计算。</p>
      </footer>
    </div>
  );
}
