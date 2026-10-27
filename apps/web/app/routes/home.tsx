import { Link, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import type { TimelineResponse, SourceItemsResponse } from "@aihot/contracts/site";
import { cachedPage, loadOr404 } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { filterParams, hasFeedFilters, itemListLd, listPath, pageMeta, readFilters, siteLd } from "../lib/seo";
import { SITE } from "@aihot/site";
import { RingMark } from "@aihot/site/brand/Logo.tsx";
import { inNav } from "../components/shell/nav";
import type { Screen } from "../components/shell/screens";
import { SourcePreview } from "../features/sources/SourcePreview";
import { Timeline } from "../features/feed/Timeline";
import { HotTopics } from "../features/feed/HotTopics";
import { ActiveFilters, CategoryTabs, FeedBar, SearchField } from "../features/feed/Filters";

export const handle: Screen = { tab: "featured", name: "精选" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  // Search lives on /all; keep the parameters so old links still land on results.
  if (q && q.trim()) throw redirect(`/all${url.search}`);
  const filters = readFilters(url.searchParams);
  const upstream = new Headers();
  const data = await loadOr404<TimelineResponse>(listPath("/api/site/timeline", filterParams(filters)), { responseHeaders: upstream, signal: request.signal });
  const sources = data.cards.length === 0
    ? await loadOr404<SourceItemsResponse>("/api/site/source-items?limit=5", { signal: request.signal })
    : null;
  return cachedPage(60, { data, filters, sources }, upstream);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const path = listPath("/", loaderData ? filterParams(loaderData.filters) : {});
  const titles = loaderData?.data.cards.map((c) => c.item.title) ?? [];
  return pageMeta({ path, noindex: hasFeedFilters(loaderData?.filters), jsonLd: path === "/" ? [...siteLd(), itemListLd("/", "精选", titles)] : undefined });
}

export default function Home() {
  const { data, filters, sources } = useLoaderData<typeof loader>();
  const title = filters.tag ? `#${filters.tag}` : "精选";
  return (
    <div className="pb-6">
      {/* Phones: the bar (精选 | 全部, filter, search), the filter in use, today's hot topics, the feed. */}
      <FeedBar base="/" category={filters.category} channel={filters.channel} />
      <ActiveFilters base="/" category={filters.category} channel={filters.channel} tag={filters.tag} />
      <section className="news-intro" aria-labelledby="news-intro-title">
        <div className="min-w-0">
          <p className="mb-3 flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] text-accent">
            <RingMark className="size-5 shrink-0" /> {SITE.name} · AI喵实验室
          </p>
          <h1 id="news-intro-title" className="text-[26px] font-bold leading-[1.35] tracking-[-0.025em] text-ink sm:text-[34px]">关注 AI 的每一步。</h1>
          <p className="mt-3 max-w-xl text-[13px] leading-[1.8] text-ink-3 sm:text-[14px]">从动态到事件，从摘要到原文。按你关心的方向，继续阅读。</p>
        </div>
        <nav aria-label="快速阅读" className="news-shortcuts">
          <Link to="/source-news" className="news-shortcut"><span className="news-shortcut-no">01</span><span>来源动态·未核验</span><span aria-hidden="true">↗</span></Link>
          <Link to="/hot" className="news-shortcut"><span className="news-shortcut-no">02</span><span>热点追踪</span><span aria-hidden="true">↗</span></Link>
          <Link to="/daily" className="news-shortcut"><span className="news-shortcut-no">03</span><span>AI喵日报</span><span aria-hidden="true">↗</span></Link>
        </nav>
      </section>
      <div className="hidden lg:block">
        <h2 className="text-[20px] font-semibold leading-[1.3] text-ink">{title === "精选" ? "每日精选" : title}</h2>
        <div className="mb-5 mt-4 flex items-center justify-between gap-4">
          <CategoryTabs base="/" category={filters.category} channel={filters.channel} layoutId="home-cat-desk" className="min-w-0" />
          <SearchField keep={{ category: filters.category }} />
        </div>
      </div>

      {data.hot && inNav("/hot") && <HotTopics entries={data.hot} />}

      <Timeline initial={data} filters={data.filters} />
      <SourcePreview data={sources} />
    </div>
  );
}
