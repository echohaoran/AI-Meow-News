// Synthetic API tests of production SSR; not real collection or deployment.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as cheerio from "cheerio";
import type { HotEntryView } from "@aihot/contracts/site";
import { fakeApi, itemDetail, startWebServer } from "../../apps/web/tests/web-server.ts";

const sourceItem = {
  id: "fixture-source-news", title: "Synthetic source news for SSR regression", sourceSummary: "A source excerpt, not a model summary.",
  source: { id: "fixture-source", name: "Fixture Source" }, links: { original: "https://example.com/fixture-news" },
  publishedAt: "2026-10-23T00:00:00.000Z", discoveredAt: "2026-10-26T00:00:00.000Z", verificationStatus: "unverified", selected: false,
};
const sourceFeed = { mode: "source", verificationStatus: "unverified", items: [sourceItem], page: 1, limit: 5, hasMore: false };

test("Chinese reading retains both sidebars and never substitutes an untranslated body or AI guide", async () => {
  const outline = [{ id: "sec-1", level: 2, text: "正文小节" }];
  const translated = itemDetail({ id: "translated-reading", title: "中文阅读", summary: "不显示的短导读", outline,
    topics: [{ slug: "ai-models", name: "模型主题" }], tags: ["模型发布"],
    body: { zh: '<h2 id="sec-1">正文小节</h2><p>完整的中文译文。</p>', original: null, zhKind: "translation", complete: true } });
  const chinese = itemDetail({ id: "chinese-reading", title: "中文原文", summary: "中文短导读", outline,
    body: { zh: '<h2 id="sec-1">正文小节</h2><p>完整的中文原文。</p>', original: null, zhKind: "original", complete: true }, hasTranslation: false });
  const pending = itemDetail({ id: "pending-reading", title: "翻译中", summary: "不显示的摘要", outline,
    body: { zh: null, original: '<p>Untranslated English body.</p>', zhKind: null, complete: false }, bodyLanguage: "original" });
  const items = [translated, chinese, pending];
  const web = await startWebServer(fakeApi(url => items.find(item => url.pathname === `/api/site/items/${item.id}`)));
  try {
    for (const item of items) {
      const response = await fetch(web.origin + `/items/${item.id}`);
      assert.equal(response.status, 200);
      const $ = cheerio.load(await response.text());
      const article = $("article");
      assert.equal(article.children("a").first().attr("href"), item.links.original);
      assert.ok(article.children("a").first().text().includes("打开原文"));
      assert.ok(!article.text().includes(item.summary!));
      assert.ok(!article.text().includes("AI 导读"));
      assert.ok(!article.text().includes("Untranslated English body."));
      if (item.id !== pending.id) {
        assert.ok(article.text().includes(item.id === translated.id ? "完整的中文译文。" : "完整的中文原文。"));
        const directory = $('nav[aria-label="本文目录"]');
        assert.equal(directory.length, 1);
        assert.equal(directory.closest("aside").length, 1);
        assert.equal(directory.find('a[href="#sec-1"]').length, 1);
        assert.equal(article.find("#sec-1").length, 1);
        if (item.id === translated.id) {
          const right = directory.closest("aside").parent().children("aside").last();
          for (const text of ["推荐理由", "AI 评分", "模型主题", "模型发布"]) assert.ok(right.text().includes(text));
          assert.equal(right.find('button[aria-label="收藏"]').length, 1);
        }
      } else {
        assert.equal($('nav[aria-label="本文目录"]').length, 0);
        assert.ok(article.text().includes("中文正文正在后台翻译"));
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
    assert.equal($('#main a[href="/feed.xml"]').length, 1);
    assert.ok($('#main button').toArray().some((button) => $(button).text().includes("Agent 提示词快速复制")));
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
    assert.equal($('#main a[href="/"]').filter((_, link) => $(link).text().trim() === "重新加载").length, 1);
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


test("hot cards use the method's badges even when historical trends cannot be compared", async () => {
  const entries: HotEntryView[] = [["surge", "new"], ["rising"], []].map((badges, i) => ({
    rank: i + 1, story: { publicId: `hot-badge-${i}`, title: `热点事件 ${i + 1}` },
    heat: 23 - i, trend: "unknown", trendPct: null, badges: badges as HotEntryView["badges"],
    participantCount: 3, sourceCount: 3, sourceNames: [], participants: [], spark: [],
    summary: null, latest: null, cover: null,
  }));
  const web = await startWebServer(fakeApi(url => url.pathname === "/api/site/hot"
    ? { entries, windowHours: 48, computedAt: "2026-10-27T02:45:00Z" }
    : undefined));
  try {
    const response = await fetch(web.origin + "/hot");
    assert.equal(response.status, 200);
    const $ = cheerio.load(await response.text());
    const expected = [["爆", "新"], ["发酵中"], []];
    const labels = ["爆", "新", "发酵中"];
    const cards = $("#main article");
    assert.equal(cards.length, entries.length);
    cards.each((i, card) => {
      const shown = $(card).find("span[title]").toArray()
        .map(el => $(el).text()).filter(text => labels.includes(text));
      assert.deepEqual(shown, expected[i]);
      assert.doesNotMatch($(card).text(), /暂不比较|新上榜|持平/);
    });
    const legend = $("#hot-method dl");
    for (const label of labels) assert.ok(legend.find("dt").toArray().some(el => $(el).text() === label));
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

test("edited Chinese reading shows its sections and pending copy never claims the original is unavailable", async () => {
  const ready = itemDetail({ id: "edited-reading", title: "中文整理示例", summary: "列表短摘要",
    outline: [{ id: "sec-1", level: 2, text: "关键事实" }],
    body: { zh: '<h2 id="sec-1">关键事实</h2><p>根据来源事实独立整理的中文段落。</p>', original: null, zhKind: "edited", complete: true } });
  const pending = itemDetail({ id: "pending-edited-reading", title: "待整理示例", summary: "列表短摘要",
    body: { zh: null, original: null, zhKind: "edited", complete: false, pending: true }, outline: [] });
  const web = await startWebServer(fakeApi(url => [ready,pending].find(item => url.pathname === `/api/site/items/${item.id}`)));
  try {
    for (const item of [ready,pending]) {
      const response = await fetch(`${web.origin}/items/${item.id}`);
      assert.equal(response.status,200);
      const $ = cheerio.load(await response.text()), article=$("article");
      assert.ok(article.children("a").first().text().includes("打开原文"));
      assert.ok(!article.text().includes("AI 导读"));
      assert.ok(!article.text().includes("列表短摘要"));
      assert.ok(!article.text().includes("正文暂不可用"));
      if (item.id === ready.id) {
        assert.ok(article.text().includes("中文整理稿 · AI 辅助"));
        assert.ok(article.text().includes("独立整理的中文段落"));
        assert.equal($('nav[aria-label="本文目录"] a[href="#sec-1"]').length,1);
      } else assert.ok(article.text().includes("中文整理稿正在后台生成"));
    }
  } finally { await web.stop(); }
});
