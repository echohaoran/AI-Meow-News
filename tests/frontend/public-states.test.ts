// Synthetic API tests of production SSR; not real collection or deployment.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as cheerio from "cheerio";
import { fakeApi, itemDetail, startWebServer } from "../../apps/web/tests/web-server.ts";

const sourceItem = {
  id: "fixture-source-news", title: "Synthetic source news for SSR regression", sourceSummary: "A source excerpt, not a model summary.",
  source: { id: "fixture-source", name: "Fixture Source" }, links: { original: "https://example.com/fixture-news" },
  publishedAt: "2026-10-23T00:00:00.000Z", discoveredAt: "2026-10-26T00:00:00.000Z", verificationStatus: "unverified", selected: false,
};
const sourceFeed = { mode: "source", verificationStatus: "unverified", items: [sourceItem], page: 1, limit: 5, hasMore: false };

test("article reading keeps its short guide and original link, with outlines only for translated bodies", async () => {
  const outline = [{ id: "sec-1", level: 2, text: "译文小节" }];
  const translated = itemDetail({ id: "translated-reading", title: "译文阅读", summary: "原始短导读", outline,
    body: { zh: '<h2 id="sec-1">译文小节</h2><p>英文原文的中文译文。</p>', original: null, zhKind: "translation", complete: true } });
  const chinese = itemDetail({ id: "chinese-reading", title: "中文阅读", summary: "中文短导读", outline,
    body: { zh: '<h2 id="sec-1">原文小节</h2><p>不重复显示的中文原文。</p>', original: null, zhKind: "original", complete: true }, hasTranslation: false });
  const pending = itemDetail({ id: "pending-reading", title: "待译文章", summary: "待译短导读", outline,
    body: { zh: null, original: '<h2 id="sec-1">Untranslated section</h2><p>Pending English body.</p>', zhKind: null, complete: false }, hasTranslation: false, bodyLanguage: "original" });
  const items = [translated, chinese, pending];
  const web = await startWebServer(fakeApi(url => items.find(item => url.pathname === `/api/site/items/${item.id}`)));
  try {
    for (const item of items) {
      const response = await fetch(web.origin + `/items/${item.id}`);
      assert.equal(response.status, 200);
      const $ = cheerio.load(await response.text());
      const article = $("article");
      assert.equal(article.children("a").first().attr("href"), item.links.original);
      assert.ok(article.text().includes(item.summary!));
      assert.ok(article.text().includes("AI 导读"));
      if (item.id === translated.id) {
        assert.ok(article.text().includes("英文原文的中文译文。"));
        const directory = $('nav[aria-label="本文目录"]');
        assert.equal(directory.length, 1);
        assert.equal(directory.closest("aside").length, 1);
        assert.equal(directory.find('a[href="#sec-1"]').length, 1);
        assert.equal(article.find("#sec-1").length, 1);
      } else {
        assert.equal($('nav[aria-label="本文目录"]').length, 0);
        assert.ok(!article.text().includes("不重复显示的中文原文。"));
        assert.ok(!article.text().includes("Pending English body."));
      }
    }
  } finally { await web.stop(); }
});

test("an empty selected feed displays API source news with its original date and unverified status", async () => {
  const web = await startWebServer(fakeApi(url => url.pathname === "/api/site/timeline"
    ? { cards: [], nextCursor: null, dayCounts: {}, hot: [], filters: { category: null, channel: "all", tag: null } }
    : url.pathname === "/api/site/source-items" ? sourceFeed : undefined));
  try {
    const response = await fetch(web.origin);
    assert.equal(response.status, 200);
    const $ = cheerio.load(await response.text());
    assert.match($("#main").text(), /AI-News · AI喵实验室/);
    assert.match($("#main").text(), /还没有精选内容/);
    for (const path of ["/source-news", "/hot", "/daily"]) assert.ok($(`#main a[href="${path}"]`).length > 0);
    const preview = $('[aria-label="来源新闻"]');
    assert.ok(preview.text().includes(sourceItem.title));
    assert.match(preview.text(), /未核验/);
    assert.equal(preview.find(`time[datetime="${sourceItem.publishedAt}"]`).length, 1);
    assert.ok(preview.find('a[href="/items/fixture-source-news"]').length > 0);
  } finally { await web.stop(); }
});

test("an unavailable feed remains an uncached 503 with branded retry content", async () => {
  const web = await startWebServer(fakeApi((url, res) => {
    if (url.pathname === "/api/site/timeline") {
      res.statusCode = 503;
      return { code: "unavailable" };
    }
  }));
  try {
    const response = await fetch(web.origin);
    assert.equal(response.status, 503);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const $ = cheerio.load(await response.text());
    assert.match($("#main").text(), /暂时无法加载/);
    assert.match($("#main").text(), /AI-News/);
    assert.equal($('#main a[href="/"]').first().text().trim(), "重新加载");
    assert.equal($('#main a[href^="/items/"]').length, 0);
  } finally { await web.stop(); }
});

test("an unpublished changelog shows no release history", async () => {
  const web = await startWebServer(fakeApi(url => url.pathname === "/api/site/changelog"
    ? { latestVersion: null, releases: [] }
    : undefined));
  try {
    const response = await fetch(web.origin + "/changelog");
    assert.equal(response.status, 200);
    const $ = cheerio.load(await response.text());
    assert.match($("#main").text(), /暂无发布记录/);
    assert.doesNotMatch($("#main").text(), /网站上线|AIHOT/);
  } finally { await web.stop(); }
});


test("an empty hot board keeps the heat rule and offers source news directly", async () => {
  const web = await startWebServer(fakeApi(url => url.pathname === "/api/site/hot"
    ? { entries: [], windowHours: 48, computedAt: null }
    : url.pathname === "/api/site/source-items" ? sourceFeed : undefined));
  try {
    const response = await fetch(web.origin + "/hot");
    assert.equal(response.status, 200);
    const $ = cheerio.load(await response.text());
    assert.match($("#main").text(), /暂时没有热点/);
    assert.match($("#main").text(), /独立来源/);
    const preview = $('[aria-label="来源新闻"]');
    assert.ok(preview.text().includes(sourceItem.title));
    assert.match(preview.text(), /不代表精选或热点/);
    assert.equal(preview.find('a[href="https://example.com/fixture-news"]').length, 1);
  } finally { await web.stop(); }
});
