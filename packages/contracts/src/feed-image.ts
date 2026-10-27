import type { FeedItemSummary } from "./site.ts";

/** A news-card image from the article's collected media, served through the image proxy. */
export interface FeedImage {
  url: string;
  srcSet?: string;
  width: number | null;
  height: number | null;
}

/** The article image is optional, so older site API responses and cards remain usable. */
export type FeedItemWithImage = FeedItemSummary & { image?: FeedImage };
