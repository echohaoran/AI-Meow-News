// Source copy is readable without model judgement. This outlet is explicitly unverified;
// curated pool/selection predicates stay unchanged. Read withdrawal and release through scope.ts.
import type { SourceItemsResponse } from "@aihot/contracts/site";
import { sql } from "../db.ts";
import { storyReportCondition } from "./scope.ts";
import { publicSourceName } from "./rules.ts";
import { searchTerms, withSearchCapacity } from "./pool.ts";
import { stripTags, collapseWhitespace } from "../lib/text.ts";

export async function loadSourceItems(opts: { sourceId: string | null; q: string | null; page: number; limit: number }): Promise<SourceItemsResponse> {
  return withSearchCapacity(async (db) => {
    await db`SET LOCAL statement_timeout = '1500ms'`;
    const now = new Date();
    const terms = searchTerms(opts.q ?? "");
    const matches = terms.reduce((condition, term) =>
      sql`${condition} AND lower(a.title || ' ' || coalesce(a.excerpt, '') || ' ' || s.name) LIKE ${"%" + term + "%"}`, sql``);
    const rows = await db<Array<{
      id: string; title: string; excerpt: string | null; source_id: string; source_name: string;
      url: string; published_at: Date; discovered_at: Date;
    }>>`
      SELECT a.id, a.title, a.excerpt, a.source_id, s.name AS source_name, a.url, a.published_at, a.discovered_at
      FROM publications p JOIN articles a ON a.id = p.article_id JOIN sources s ON s.id = a.source_id
      WHERE ${storyReportCondition(now)} AND p.channel = 'news'
        AND a.published_at IS NOT NULL AND a.published_at <= ${now}
        ${opts.sourceId ? sql`AND a.source_id = ${opts.sourceId}` : sql``}
        ${matches}
      ORDER BY a.published_at DESC, a.id DESC
      LIMIT ${opts.limit + 1} OFFSET ${(opts.page - 1) * opts.limit}`;
    return {
      mode: "source", verificationStatus: "unverified", page: opts.page, limit: opts.limit,
      hasMore: rows.length > opts.limit,
      items: rows.slice(0, opts.limit).map((r) => ({
        id: r.id, title: collapseWhitespace(stripTags(r.title)),
        sourceSummary: r.excerpt ? collapseWhitespace(stripTags(r.excerpt)).slice(0, 2000) || null : null,
        source: { id: r.source_id, name: publicSourceName(r.source_name) },
        links: { original: r.url }, publishedAt: r.published_at.toISOString(),
        discoveredAt: r.discovered_at.toISOString(),
        // This view only reports source copy; it makes no claim about model generation or fact checks.
        verificationStatus: "unverified", selected: false,
      })),
    };
  });
}
