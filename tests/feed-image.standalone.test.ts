import assert from "node:assert/strict";
import { test } from "node:test";
import { toFeedItemSummary, type ItemRow } from "@aihot/backend/publication/items";
import { containsQr } from "@aihot/backend/media/qr";
import sharp from "sharp";
import { renderSVG } from "uqr";

function article(media: ItemRow["article_media"]): ItemRow {
  return {
    id: "article-image", title: "图片新闻", original_title: null, summary: "摘要", reason: null,
    category: null, tags: [], score: null, selected: false, channel: "news", url: "https://example.org/article",
    published_at: new Date("2026-10-27T00:00:00Z"), discovered_at: new Date("2026-10-27T00:00:00Z"),
    timeline_at: new Date("2026-10-27T00:00:00Z"), seat: false, visibility: "public", body_mode: "summary",
    indexable: false, fact_id: null, source_name: "来源", source_mode: "editorial", x_post: null,
    author: null, language: "zh", story_public_id: null, story_title: null, zh_text: null, quoted_zh: null,
    article_media: media,
  };
}

test("news cards select the first usable collected image and sign it through the existing proxy", () => {
  const item = toFeedItemSummary(article([
    { kind: "image", url: "https://example.org/pixel.gif", width: 1, height: 1 },
    { kind: "video", url: "https://example.org/movie.mp4" },
    { kind: "image", url: "https://example.org/cover.jpg", width: 1200, height: 800 },
  ]));
  assert.ok(item.image);
  const url = new URL(item.image.url, "https://local.invalid");
  assert.equal(url.pathname, "/api/img-proxy");
  assert.equal(url.searchParams.get("u"), "https://example.org/cover.jpg");
  assert.equal(url.searchParams.get("mode"), "article-card");
  assert.match(item.image.srcSet ?? "", /336w.*720w/);
  assert.equal(item.image.width, 1200);
  assert.equal(item.image.height, 800);
});

test("no usable image leaves the card without an image; X media keeps its existing treatment", () => {
  assert.equal(toFeedItemSummary(article([])).image, undefined);
  assert.equal(toFeedItemSummary(article([{ kind: "image", url: "https://example.org/pixel.gif", width: 1, height: 1 }])).image, undefined);
  assert.equal(toFeedItemSummary(article([{ kind: "image", url: "javascript:alert(1)" }])).image, undefined);
  const x = article([{ kind: "image", url: "https://example.org/cover.jpg" }]);
  x.channel = "x";
  assert.equal(toFeedItemSummary(x).image, undefined);
});

test("image scan detects an embedded QR code and keeps ordinary editorial images", async () => {
  const code = await sharp(Buffer.from(renderSVG("https://example.org/test", { pixelSize: 4, border: 4 }))).png().toBuffer();
  const clean = await sharp({ create: { width: 750, height: 400, channels: 3, background: "#b22832" } }).png().toBuffer();
  const withCode = await sharp(clean).composite([{ input: code, top: 100, left: 450 }]).png().toBuffer();
  const jpeg = await sharp(withCode).jpeg({ quality: 85 }).toBuffer();
  assert.equal(await containsQr("qr-png", withCode), true);
  assert.equal(await containsQr("qr-jpeg", jpeg), true);
  assert.equal(await containsQr("plain", clean), false);
});
