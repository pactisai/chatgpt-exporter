import { fetchChatGptShare, fetchChatGptShareHtml, parseChatGptShareHtml } from "chatgpt-share-parser";
import { getPage, releasePage } from "./pool.js";
import { installResourceBlockers } from "./blocker.js";

const STRIDE = 6;
const SCROLL_WAIT_MS = 200;

export async function scrapeChatGPT(shareUrl, onProgress) {
  onProgress?.({ phase: "fastpath", message: "Fetching via API..." });
  const startTime = Date.now();

  try {
    const chat = await fetchChatGptShare(shareUrl);

    if (chat && chat.replies && chat.replies.length > 0) {
      const turns = chat.replies.map((r, i) => ({
        index: i + 1,
        role: r.type === "user" ? "user" : "assistant",
        content: formatReply(r),
      }));

      const elapsed = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
      onProgress?.({ phase: "done", message: `Done: ${turns.length} turns (instant)` });

      return {
        turns,
        markdown: formatMarkdown(turns),
        plainText: formatText(turns),
        totalTurns: turns.length,
        scrapedAt: new Date().toISOString(),
        elapsedSeconds: elapsed,
        method: "fastpath-parser",
      };
    }
  } catch (e) {
    console.warn("[scraper] Fast path failed:", e.message);
  }

  onProgress?.({ phase: "loading", message: "Falling back to browser..." });
  return playwrightFallback(shareUrl, onProgress);
}

async function playwrightFallback(shareUrl, onProgress) {
  let page;
  const startTime = Date.now();

  try {
    page = await getPage();
    await installResourceBlockers(page);
    await page.goto(shareUrl, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(3000);

    const turnCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid^="conversation-turn-"]').length
    );

    if (turnCount === 0) {
      await releasePage(page);
      return { turns: [], markdown: "", plainText: "", totalTurns: 0,
        scrapedAt: new Date().toISOString(), error: "No turns found." };
    }

    onProgress?.({ phase: "scraping", message: `Found ${turnCount} turns`, total: turnCount, current: 0 });

    const extracted = new Map();

    for (let i = 0; i < turnCount; i += STRIDE) {
      const target = Math.min(i + Math.floor(STRIDE / 2), turnCount - 1);
      await page.evaluate((idx) => {
        const s = document.querySelectorAll('[data-testid^="conversation-turn-"]')[idx];
        if (s) s.scrollIntoView({ behavior: "instant", block: "center" });
      }, target);
      await page.waitForTimeout(SCROLL_WAIT_MS);

      const batch = await page.evaluate(() => {
        const all = document.querySelectorAll('[data-testid^="conversation-turn-"]');
        const res = [];
        for (let j = 0; j < all.length; j++) {
          const text = all[j].textContent?.trim() || "";
          if (text.length > 0) {
            res.push({
              index: j + 1,
              role: all[j].getAttribute("data-turn") || "unknown",
              content: text,
            });
          }
        }
        return res;
      });

      for (const t of batch) extracted.set(t.index, t);
      onProgress?.({ phase: "scraping", message: `${extracted.size}/${turnCount}`, total: turnCount, current: extracted.size });
    }

    const turns = [...extracted.values()].sort((a, b) => a.index - b.index);
    await releasePage(page);

    const elapsed = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

    return {
      turns,
      markdown: formatMarkdown(extractedTurnsToArray(turns)),
      plainText: formatText(extractedTurnsToArray(turns)),
      totalTurns: turns.length,
      scrapedAt: new Date().toISOString(),
      elapsedSeconds: elapsed,
      method: "playwright-fallback",
    };
  } catch (e) {
    if (page) await releasePage(page);
    throw e;
  }
}

function extractedTurnsToArray(turns) {
  return turns.map(t => ({ index: t.index, role: t.role, content: t.content }));
}

function formatReply(reply) {
  const prefix = reply.type === "assistant" ? "ChatGPT said:" : "You said:";
  let text = prefix + reply.statement;

  if (reply.assets && reply.assets.length > 0) {
    for (const asset of reply.assets) {
      if (asset.assetType === "image") {
        text += `\n[${asset.assetType}: ${asset.filename || asset.url}]`;
      }
    }
  }

  return text;
}

export function formatMarkdown(turns) {
  let md = "# ChatGPT Conversation Export\n\n*Exported by ChatGPT Exporter by Pactis*\n\n---\n\n";
  for (const t of turns) {
    const rl = t.role === "assistant" ? "### Assistant" : "### User";
    md += `${rl} (Turn ${t.index})\n\n${t.content}\n\n---\n\n`;
  }
  return md;
}

export function formatText(turns) {
  let text = "ChatGPT Conversation Export\n==========================\n\n";
  for (const t of turns) {
    const lbl = t.role === "assistant" ? "Assistant" : "User";
    text += `[${lbl} - Turn ${t.index}]\n${t.content}\n\n---\n\n`;
  }
  return text;
}
