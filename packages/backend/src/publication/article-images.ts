import * as cheerio from "cheerio";
import { HIDDEN_ARTICLE_IMAGE_SOURCES } from "@aihot/site";

export function hidesArticleImages(sourceId: string | null | undefined): boolean {
  return !!sourceId && HIDDEN_ARTICLE_IMAGE_SOURCES.includes(sourceId);
}

/** Remove publisher images without removing the surrounding text or playable videos. */
export function sourceArticleHtml(html: string, sourceId: string | null | undefined): string {
  if (!hidesArticleImages(sourceId)) return html;
  const $ = cheerio.load(html, null, false);
  $("picture, img").remove();
  $("video[poster]").removeAttr("poster");
  return $.html();
}
