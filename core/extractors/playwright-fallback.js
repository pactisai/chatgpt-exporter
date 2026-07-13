import { getPage, releasePage } from "../pool.js";
import { installResourceBlockers } from "../blocker.js";

const STRIDE = 6;
const SCROLL_WAIT_MS = 200;

export async function extractViaPlaywright(shareUrl, onProgress) {
  let page;
  const startTime = Date.now();

  try {
    onProgress?.({ phase: "loading", message: "Falling back to browser..." });
    page = await getPage();
    await installResourceBlockers(page);
    await page.goto(shareUrl, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(3000);

    const turnCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid^="conversation-turn-"]').length
    );

    if (turnCount === 0) {
      await releasePage(page);
      return { turns: [], totalTurns: 0, scrapedAt: new Date().toISOString(),
        error: "No turns found.", method: "playwright-fallback",
        elapsedSeconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)) };
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
            res.push({ index: j + 1,
              role: all[j].getAttribute("data-turn") || "unknown",
              content: text });
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
    return { turns, totalTurns: turns.length, scrapedAt: new Date().toISOString(),
      elapsedSeconds: elapsed, method: "playwright-fallback" };
  } catch (e) {
    if (page) await releasePage(page);
    throw e;
  }
}
