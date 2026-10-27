import { pointModels, stub, tag, gate } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { publishArticle } from "@aihot/backend/publication/publish";
import { loadItemDetail, exportMarkdown } from "@aihot/backend/publication/detail";
import { installModules } from "@aihot/backend/modules";
import { stopBoss } from "@aihot/backend/jobs/queue";
import reading from "../server.ts";
import { composeReading } from "../backend/reading.ts";

const T = tag(), sourceId = `test-reading-${T}`;
let hold: ReturnType<typeof gate<void>> | null = null;
let asked = gate<void>();
const provider = await stub(async () => {
  if (hold) { asked.open(); await hold.promise; }
  return { id: "reading-stub", choices: [{ message: { content: JSON.stringify({ sections: [
    { heading: "发布了什么", paragraphs: ["示例机构公布一项测试结果，报告中的数字为十。这是对来源事实的中文整理。"] },
    { heading: "证据与限制", paragraphs: ["结果来自机构自行公布的数据，报道没有提供独立验证，仍需结合原始资料判断。"] },
  ] }) } }], usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 } };
});

before(async () => {
  pointModels(provider.url); process.env.TRANSLATE_MODEL = "deepseek-flash";
  installModules([reading]);
  await sql`INSERT INTO sources(id,name,kind,tier,participation_mode,site_fulltext,syndicate_fulltext,next_fetch_at)
    VALUES(${sourceId},'Reading fixture','rss','T2','editorial',false,false,'2100-01-01')`;
});
after(async () => { installModules([]); await provider.close(); await stopBoss(); await closeDb(); });

async function material(name: string, language: string, body: string) {
  const result = await upsertMaterial({ sourceId, url: `https://example.com/${T}/${name}`, title: `Source ${name}`, language,
    bodyText: body, bodyHtml: `<p>${body}</p>`, bodyStatus: "ok", via: "fetch", publishedAt: new Date() });
  await sql`INSERT INTO analyses(article_id,input_revision,origin,relevance,title_zh,summary_zh,score,selected)
    VALUES(${result.articleId},1,'rule','pass','中文标题','列表摘要',40,false)`;
  await publishArticle(result.articleId);
  return result.articleId;
}

for (const [name,language,body] of [["chinese","zh","这是中文素材，包含机构自行公布的十项测试结果。"],["english","en","The institution announced ten test results, without independent verification."]]) {
  test(`${language} summary-permission articles receive Chinese reading copies without exposing originals`, async () => {
    const id = await material(name,language,body);
    const hits = provider.hits();
    const pending = await loadItemDetail(id);
    assert.equal(provider.hits(),hits,"page reads never call a model");
    assert.equal(pending.kind,"found");
    if (pending.kind!=="found")return;
    assert.equal(pending.row.body_mode,"summary");
    assert.equal(pending.item.body?.pending,true);
    assert.equal(pending.item.body?.original,null);
    const result = await composeReading(id);
    assert.equal(result.status,"written");
    const detail = await loadItemDetail(id);
    assert.equal(detail.kind,"found");
    if (detail.kind!=="found")return;
    assert.equal(detail.item.body?.zhKind,"edited");
    assert.ok(detail.item.body?.zh?.includes("机构自行公布"));
    assert.ok(!detail.item.body?.zh?.includes(body));
    assert.equal(detail.item.body?.original,null);
    assert.equal(detail.item.outline.length,2);
    assert.match((await exportMarkdown(id))!.body,/中文整理稿/);
    const written = provider.hits();
    assert.equal((await composeReading(id)).status,"skipped");
    assert.equal(provider.hits(),written,"an unchanged revision is not billed again");
    assert.equal((await sql`SELECT site_fulltext FROM sources WHERE id=${sourceId}`)[0].site_fulltext,false);
  });
}

test("a corrected article never displays or stores an old revision's delayed reading copy",async()=>{
  const id=await material("revision","en","Original material before correction.");
  hold=gate<void>();asked=gate<void>();
  const writing=composeReading(id);await asked.promise;
  await upsertMaterial({sourceId,url:`https://example.com/${T}/revision`,title:"Corrected",language:"en",bodyText:"The corrected material reports twenty results.",bodyHtml:"<p>The corrected material reports twenty results.</p>",bodyStatus:"ok",via:"fetch",publishedAt:new Date()});
  hold.open();hold=null;
  assert.equal((await writing).status,"superseded");
  const detail=await loadItemDetail(id);assert.equal(detail.kind,"found");
  if(detail.kind==="found")assert.equal(detail.item.body?.zh,null);
  assert.equal((await sql`SELECT count(*)::int AS n FROM translations WHERE article_id=${id} AND lang='zh-reading'`)[0].n,0);
});

test("withdrawn articles cannot expose a previously generated reading or Markdown",async()=>{
  const id=await material("withdrawn","zh","用于撤回检查的原始素材，包含机构宣布的十项结果。");
  await composeReading(id);
  await sql`UPDATE publications SET visibility='withdrawn' WHERE article_id=${id}`;
  assert.equal((await loadItemDetail(id)).kind,"not_found");
  assert.equal(await exportMarkdown(id),null);
});
