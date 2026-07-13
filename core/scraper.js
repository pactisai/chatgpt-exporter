import { chromium } from "playwright";

const PAGE_WAIT_MS = 3000;
const TURN_WAIT_MS = 90;

export async function scrapeChatGPT(shareUrl, onProgress) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--no-first-run",
    ],
  });
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
      return { turns: [], markdown: "", plainText: "", totalTurns: 0, scrapedAt: new Date().toISOString(), error: "No turns found." };
    }

    onProgress?.({ phase: "scraping", message: `Found ${turnCount} turns`, total: turnCount, current: 0 });

    const turns = [];

    for (let i = 0; i < turnCount; i++) {
      await page.evaluate((idx) => {
        const s = document.querySelectorAll('[data-testid^="conversation-turn-"]')[idx];
        if (s) s.scrollIntoView({ behavior: "instant", block: "center" });
      }, i);

      await page.waitForTimeout(TURN_WAIT_MS);

      const td = await page.evaluate((idx) => {
        const s = document.querySelectorAll('[data-testid^="conversation-turn-"]')[idx];
        if (!s) return null;
        const text = s.textContent?.trim() || "";
        return text.length > 0
          ? { index: idx + 1, role: s.getAttribute("data-turn") || "unknown", content: text }
          : null;
      }, i);

      if (td) turns.push(td);

      if (i % 40 === 0 || i === turnCount - 1) {
        onProgress?.({ phase: "scraping", message: `${i + 1}/${turnCount}`, total: turnCount, current: i + 1 });
      }
    }

    await browser.close();

    const elapsed = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

    return {
      turns,
      markdown: formatMarkdown(turns),
      plainText: formatText(turns),
      totalTurns: turns.length,
      scrapedAt: new Date().toISOString(),
      elapsedSeconds: elapsed,
    };
  } catch (e) {
    await browser.close();
    throw e;
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
