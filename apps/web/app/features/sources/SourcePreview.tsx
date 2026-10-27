import { Link } from "react-router";
import type { SourceItemsResponse } from "@aihot/contracts/site";
import { fullDateTime } from "../../lib/format";

/** Source copy stays readable while curated feeds wait for editorial/event conditions. */
export function SourcePreview({ data }: { data: SourceItemsResponse | null }) {
  if (!data?.items.length) return null;
  return (
    <section aria-label="来源新闻" className="card mt-5 rounded-sheet p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] font-semibold text-ink">来源新闻</h2>
        <Link to="/source-news" className="text-[13px] text-accent underline">查看全部来源动态</Link>
      </div>
      <p className="mb-3 text-[13px] leading-relaxed text-ink-3">以下是已收录的来源新闻，尚未经独立事实核验；不代表精选或热点。时间为来源原始发布时间。</p>
      <ul className="divide-y divide-line">
        {data.items.slice(0, 5).map(item => (
          <li key={item.id} className="py-3">
            <div className="mb-1 flex flex-wrap gap-x-3 text-[12px] text-ink-3">
              <span>{item.source.name} · 未核验</span>
              <time dateTime={item.publishedAt}>{fullDateTime(item.publishedAt)}</time>
            </div>
            <h3 className="font-semibold leading-relaxed text-ink"><Link to={`/items/${encodeURIComponent(item.id)}`}>{item.title}</Link></h3>
            {item.sourceSummary && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">来源摘要：{item.sourceSummary}</p>}
            <a href={item.links.original} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[13px] text-accent underline">阅读原文 ↗</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
