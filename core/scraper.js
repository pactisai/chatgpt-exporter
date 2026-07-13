import { chromium } from "playwright";

const PAGE_WAIT_MS = 5000;
const STRIDE = 6;
const SCROLL_WAIT_MS = 300;

export async function scrapeChatGPT(shareUrl, onProgress) {
  let browser;
  try {
    onProgress?.({ phase: "loading", message: "Launching browser..." });

    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--no-first-run",
      ],
    });
  } catch (e) {
    return {
      turns: [], markdown: "", plainText: "",
      totalTurns: 0, scrapedAt: new Date().toISOString(),
      error: `Browser launch failed: ${e.message}`,
    };
  }

  const page = await browser.newPage();
  const startTime = Date.now();

  try {
    onProgress?.({ phase: "loading", message: "Loading page..." });

    await page.goto(shareUrl, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(PAGE_WAIT_MS);

    const turnCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid^="conversation-turn-"]').length
    );

    if (turnCount === 0) {
      await browser.close();
      return {
        turns: [], markdown: "", plainText: "",
        totalTurns: 0, scrapedAt: new Date().toISOString(),
        error: "No conversation turns found. The page may require login or the link is invalid.",
      };
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

      for (const t of batch) {
        if (!extracted.has(t.index)) extracted.set(t.index, t);
      }

      onProgress?.({ phase: "scraping", message: `${extracted.size}/${turnCount}`, total: turnCount, current: extracted.size });
    }

    const turns = [...extracted.values()].sort((a, b) => a.index - b.index);
    await browser.close();

    const elapsed = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

    return {
      turns,
      markdown: formatMarkdown(turns),
      plainText: formatText(turns),
      totalTurns: turns.length,
      scrapedAt: new Date().toISOString(),
      elapsedSeconds: elapsed,
      method: "playwright-batched",
    };
  } catch (e) {
    await browser.close();
    return {
      turns: [], markdown: "", plainText: "",
      totalTurns: 0, scrapedAt: new Date().toISOString(),
      error: `Scrape failed: ${e.message}`,
    };
  }
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
