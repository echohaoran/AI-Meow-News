// Independent factual Chinese reading copies; originals and their redistribution permissions stay intact.
import * as cheerio from "cheerio";
import { z } from "zod";
import { sql } from "@aihot/backend/db";
import { bodyToMarkdown } from "@aihot/backend/content/markdown";
import { textToHtml, trimTrailingChrome } from "@aihot/backend/content/sanitize";
import { escapeXml, isChineseText } from "@aihot/backend/lib/text";
import { modelRoute } from "@aihot/backend/editorial/models";
import { promptText, promptVersion } from "@aihot/backend/editorial/prompts";
import { chatJson } from "@aihot/backend/providers/llm";
import { completeReceipt, failureKind, ProviderRejectedError } from "@aihot/backend/providers/receipts";
import { emit } from "@aihot/backend/modules";
import { shutdownSignal } from "@aihot/backend/jobs/queue";

const LANG = "zh-reading";
const VERSION = promptVersion("reader-body");
const SYSTEM = promptText("reader-body");
const Chinese = z.string().trim().min(1).refine(text => isChineseText(text), "reading copy must be Chinese");
const Output = z.object({ sections: z.array(z.object({ heading: Chinese, paragraphs: z.array(Chinese).min(1).max(8) })).min(1).max(6) });

export async function readReading({ id, revision }: { id: string; revision: number }): Promise<{ html: string | null } | null> {
  const [row] = await sql<{ body_html: string | null }[]>`
    SELECT r.body_html FROM articles a JOIN publications p ON p.article_id=a.id JOIN sources s ON s.id=p.source_id
    LEFT JOIN translations r ON r.article_id=a.id AND r.lang=${LANG} AND r.revision=${revision} AND r.complete
    WHERE a.id=${id} AND a.revision=${revision} AND p.visibility='public' AND p.channel<>'x'
      AND s.participation_mode='editorial' AND a.body_status='ok' AND length(coalesce(a.body_text,''))>0`;
  return row ? { html: row.body_html } : null;
}

export async function composeReading(articleId: string) {
  const [row] = await sql<{ revision: number; title: string; url: string; source: string; body_html: string | null; body_text: string; ready: boolean }[]>`
    SELECT a.revision,p.title,p.url,s.name AS source,a.body_html,a.body_text,
      EXISTS(SELECT 1 FROM translations r WHERE r.article_id=a.id AND r.lang=${LANG} AND r.revision=a.revision AND r.complete) AS ready
    FROM articles a JOIN publications p ON p.article_id=a.id JOIN sources s ON s.id=p.source_id
    WHERE a.id=${articleId} AND p.visibility='public' AND p.channel<>'x' AND s.participation_mode='editorial'
      AND a.body_status='ok' AND length(coalesce(a.body_text,''))>0`;
  if (!row || row.ready) return { articleId, status: "skipped" as const };
  shutdownSignal.signal.throwIfAborted();
  const html = row.body_html ? trimTrailingChrome(row.body_html) : textToHtml(row.body_text);
  const response = await chatJson({
    ...await modelRoute("translate"), purpose: "translate_body", subject: `reading:${articleId}@${row.revision}`,
    promptVersion: VERSION, system: SYSTEM,
    user: JSON.stringify({ source: row.source, title: row.title, url: row.url, material: bodyToMarkdown(html, row.url) }),
    schema: Output, temperature: 0.2, maxTokens: 8000, timeoutMs: 180_000,
  });
  const body = response.data.sections.map(section => `<h2>${escapeXml(section.heading)}</h2>${section.paragraphs.map(textToHtml).join("")}`).join("");
  const text = cheerio.load(body, null, false).root().text();
  const stored = await sql.begin(async tx => {
    const [current] = await tx`SELECT revision FROM articles WHERE id=${articleId} FOR UPDATE`;
    if (current?.revision !== row.revision) {
      await completeReceipt(tx, response.receiptId);
      return false;
    }
    await tx`INSERT INTO translations(article_id,lang,revision,title,body_html,body_text,complete,origin)
      VALUES(${articleId},${LANG},${row.revision},${row.title},${body},${text},true,'model')
      ON CONFLICT(article_id,lang) DO UPDATE SET revision=EXCLUDED.revision,title=EXCLUDED.title,
        body_html=EXCLUDED.body_html,body_text=EXCLUDED.body_text,complete=true,origin='model',created_at=now()
      WHERE translations.revision<=EXCLUDED.revision`;
    await completeReceipt(tx, response.receiptId);
    await emit("articleChanged", { id: articleId, kind: "body", reason: "Chinese reading copy" }, tx);
    return true;
  });
  return { articleId, revision: row.revision, status: stored ? "written" as const : "superseded" as const };
}

export async function composePendingReadings(opts: { limit?: number; budgetMs?: number } = {}) {
  const start = Date.now();
  const pending = await sql<{ article_id: string }[]>`
    SELECT p.article_id FROM publications p JOIN articles a ON a.id=p.article_id JOIN sources s ON s.id=p.source_id
    WHERE p.visibility='public' AND p.channel<>'x' AND s.participation_mode='editorial'
      AND a.body_status='ok' AND length(coalesce(a.body_text,''))>0
      AND NOT EXISTS(SELECT 1 FROM translations r WHERE r.article_id=a.id AND r.lang=${LANG} AND r.revision=a.revision AND r.complete)
    ORDER BY p.selected DESC,p.discovered_at DESC LIMIT ${opts.limit ?? 30}`;
  const done: Array<{ articleId: string; status: string; reason?: string }> = [];
  for (const row of pending) {
    if (shutdownSignal.signal.aborted || Date.now()-start>=(opts.budgetMs ?? 240_000)) break;
    try { done.push(await composeReading(row.article_id)); }
    catch (error) {
      if (shutdownSignal.signal.aborted || ["off","budget","outage"].includes(failureKind(error)) || error instanceof ProviderRejectedError && error.accessRefused) break;
      done.push({ articleId: row.article_id, status: "pending", reason: (error as Error).message.slice(0,200) });
    }
  }
  return { done };
}
