import { useLoaderData } from "react-router";
import { SITE, subjectAfter, withSubject } from "@aihot/site";
import type { Route } from "./+types/topics";
import type { TopicSummary, TopicsResponse } from "@aihot/contracts/site";
import { apiGet, cachedPage } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { breadcrumbLd, pageMeta, siteUrl } from "../lib/seo";
import { relativeTime } from "../lib/format";
import { IconArrowUpRight, IconChevronRight } from "../components/icons";
import { IntentLink } from "../components/ui/IntentLink";
import { BrandMark } from "../components/BrandMark";
import { PhoneBar } from "../components/shell/PhoneBar";
import { navUp } from "../components/shell/nav";
import type { Screen } from "../components/shell/screens";

export const handle: Screen = { home: navUp("/topics").tab, name: "板块" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: { request: Request }) {
  return cachedPage(300, await apiGet<TopicsResponse>("/api/site/topics", { signal: request.signal }));
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return pageMeta({ title: SITE.topicsTitle, path: "/topics", image: "/og/pages/topics.png" });
  const { groups, topics } = loaderData;
  const by = groups.map((g) => g.name).join("、");
  const indexed = topics.filter((t) => t.indexable);
  const named = indexed.slice(0, 6).map((t) => t.name.split(" / ")[0]).join("、");
  const base = siteUrl();
  return pageMeta({
    title: SITE.topicsTitle,
    description: `按${by}${subjectAfter("追踪", "最新动态")}：${named ? `${named}等 ` : ""}${topics.length} 个板块，浏览最新精选与重要进展，持续更新。`,
    path: "/topics",
    image: "/og/pages/topics.png",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${base}/topics#collection`,
        url: `${base}/topics`,
        name: withSubject("板块"),
        inLanguage: SITE.locale,
        isPartOf: { "@id": `${base}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: indexed.length,
          itemListElement: indexed.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, url: `${base}/topics/${t.slug}` })),
        },
      },
      breadcrumbLd([{ name: SITE.name, path: "/" }, { name: "板块", path: "/topics" }]),
    ],
  });
}

/** Phones: a row per topic in a grouped list; wider screens: a card per topic. */
function TopicCard({ t }: { t: TopicSummary }) {
  return (
    <IntentLink
      viewTransition
      to={`/topics/${t.slug}`}
      className="group flex items-center gap-4 px-4 py-5 transition-colors active:bg-bg-sunk lg:card lg:card-hover lg:h-full lg:min-h-[208px] lg:flex-col lg:items-stretch lg:gap-0 lg:p-6 lg:active:bg-surface"
    >
      {t.brand && (
        <span className="flex shrink-0 lg:hidden">
          <BrandMark brand={t.brand} size={36} />
        </span>
      )}
      <span className="min-w-0 flex-1 lg:flex lg:flex-col">
        <span className="flex items-center gap-3 text-[16px] font-semibold leading-[1.5] text-ink transition-colors group-hover:text-accent">
          {t.brand && (
            <span className="hidden lg:flex">
              <BrandMark brand={t.brand} size={36} />
            </span>
          )}
          {t.name}
          <IconArrowUpRight size={16} className="ml-auto hidden shrink-0 text-ink-3 group-hover:text-accent lg:block" />
        </span>
        <span className="mt-1 line-clamp-2 text-[14px] leading-[1.75] text-ink-3 lg:mt-4">
          {t.latest?.title ?? t.definition}
        </span>
        <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3 lg:mt-auto lg:justify-between lg:pt-5">
          {t.latest && <time dateTime={t.latest.at} suppressHydrationWarning>{relativeTime(t.latest.at)}</time>}
          <span>
            {t.recent > 0 ? (
              <>
                近 30 天 <span className="num font-semibold text-ink-3">{t.recent}</span> 条
              </>
            ) : (
              "近 30 天暂无新精选"
            )}
          </span>
        </span>
      </span>
      <IconChevronRight size={16} className="shrink-0 text-ink-4 lg:hidden" />
    </IntentLink>
  );
}

export default function TopicsPage() {
  const { groups, topics } = useLoaderData<typeof loader>();
  return (
    <div className="pb-10">
      <PhoneBar back={{ to: "/more", label: "我的" }} title="板块" />
      <header className="border-b border-line pb-8 pt-4 lg:pb-10 lg:pt-2">
        <p className="mb-3 text-[12px] font-medium tracking-[0.08em] text-accent">板块索引</p>
        <h1 data-page-title="" className="text-[28px] font-semibold leading-[1.35] text-ink lg:text-[40px]">{subjectAfter("按板块看")}</h1>
        <p className="mt-4 max-w-[48em] text-[16px] leading-[1.75] text-ink-3">
          {`按${groups.map((g) => g.name).join("、")}浏览 `}
          <span className="num">{topics.length}</span> 个板块，追踪最新精选与重要进展。
        </p>
        <nav aria-label="板块分组" className="mt-6 flex flex-wrap gap-3">
          {groups.map((group) => <a key={group.key} href={`#topics-${group.key}`} className="inline-flex min-h-11 items-center gap-3 rounded-control border border-line px-4 text-[14px] text-ink hover:border-accent hover:bg-accent-softer">{group.name}<span className="num text-[12px] text-ink-3">{topics.filter(t => t.group === group.key).length}</span></a>)}
        </nav>
      </header>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`topics-${g.key}`} className="pt-10 lg:pt-12">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h2 id={`topics-${g.key}`} className="scroll-mt-20 text-[20px] font-semibold text-ink lg:text-[24px]">
              {g.name}
            </h2>
            <p className="text-[14px] text-ink-3">{g.blurb}</p>
          </div>
          <ul className="mt-5 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface lg:mt-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:divide-y-0 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent min-[1180px]:grid-cols-3">
            {topics
              .filter((t) => t.group === g.key)
              .map((t) => (
                <li key={t.slug}>
                  <TopicCard t={t} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
