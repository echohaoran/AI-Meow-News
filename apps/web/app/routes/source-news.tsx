import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/source-news";
import type { SourceItemsResponse } from "@aihot/contracts/site";
import { cachedPage, loadOr404 } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta } from "../lib/seo";
import { fullDateTime } from "../lib/format";
import { EmptyState } from "../components/ui/Page";
import { PhoneBar } from "../components/shell/PhoneBar";
import type { Screen } from "../components/shell/screens";

export const handle: Screen = { tab: "featured", name: "来源动态" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const sourceId = url.searchParams.get("sourceId") || "";
  const params = new URLSearchParams();
  for (const [key, value] of [["q", q], ["sourceId", sourceId], ["page", url.searchParams.get("page") ?? "1"]]) {
    if (value) params.set(key!, value);
  }
  const upstream = new Headers();
  const data = await loadOr404<SourceItemsResponse>(`/api/site/source-items?${params}`, { signal: request.signal, responseHeaders: upstream });
  return cachedPage(60, { data, q, sourceId }, upstream);
}

export function meta() {
  return pageMeta({ title: "来源动态·未核验", path: "/source-news", noindex: true });
}

export default function SourcesPage() {
  const { data, q, sourceId } = useLoaderData<typeof loader>();
  const href = (page: number, source = sourceId) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (source) sp.set("sourceId", source);
    if (page > 1) sp.set("page", String(page));
    return `/source-news${sp.size ? `?${sp}` : ""}`;
  };
  return (
    <div className="pb-8">
      <PhoneBar back={{ to: "/", label: "精选" }} title="来源动态" />
      <h1 className="mb-3 text-[24px] font-semibold text-ink">来源动态·未核验</h1>
      <p className="mb-5 text-[14px] leading-relaxed text-ink-3">以下内容保留来源标题、摘要和发布时间，尚未经独立事实核验。来源摘要不代表 AI 摘要或本站推荐；更早发布的资料仍显示原时间。点击来源名称可只看该来源。</p>
      <Form method="get" className="mb-5 flex flex-wrap items-end gap-3" role="search">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-ink-3">搜索来源标题与摘要
          <input type="search" name="q" defaultValue={q} minLength={2} maxLength={200} className="min-h-11 rounded-control border border-line bg-surface px-3 text-ink" />
        </label>
        {sourceId && <input type="hidden" name="sourceId" value={sourceId} />}
        <button type="submit" className="min-h-11 rounded-control bg-accent px-4 text-[var(--accent-contrast)]">搜索与筛选</button>
        {(q || sourceId) && <Link to="/source-news" className="py-3 text-accent underline">清除条件</Link>}
      </Form>
      {data.items.length === 0 ? <EmptyState title="暂无匹配的来源动态">可以清除条件或稍后重试。</EmptyState> : (
        <ul className="divide-y divide-line">
          {data.items.map(item => (
            <li key={item.id} className="py-5">
              <div className="mb-2 flex flex-wrap gap-2 text-[12px] text-ink-3">
                <span className="rounded-full bg-well px-2 py-1">未核验 · 未精选</span>
                <Link to={href(1, item.source.id)} className="py-1 text-accent underline">{item.source.name}</Link>
                <time dateTime={item.publishedAt} className="py-1">来源发布（北京时间）：{fullDateTime(item.publishedAt)}</time>
              </div>
              <h2 className="text-[18px] font-semibold leading-relaxed text-ink"><Link to={`/items/${encodeURIComponent(item.id)}`}>{item.title}</Link></h2>
              {item.sourceSummary && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink-3"><span className="font-medium">来源摘要：</span>{item.sourceSummary}</p>}
              <div className="mt-3 flex gap-4 text-[13px] text-accent">
                <Link to={`/items/${encodeURIComponent(item.id)}`}>站内详情</Link>
                <a href={item.links.original} target="_blank" rel="noopener noreferrer">阅读原文 ↗</a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="来源动态分页" className="mt-5 flex justify-between text-accent">
        {data.page > 1 ? <Link to={href(data.page - 1)}>上一页</Link> : <span />}
        <span className="text-ink-3">第 {data.page} 页</span>
        {data.hasMore && data.page < 50 ? <Link to={href(data.page + 1)}>下一页</Link> : <span />}
      </nav>
    </div>
  );
}
