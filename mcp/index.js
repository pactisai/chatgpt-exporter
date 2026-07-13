import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium } from "playwright";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function quickSummary(shareUrl) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(shareUrl, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(4000);

    const turnCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid^="conversation-turn-"]').length
    );

    if (turnCount === 0) {
      await browser.close();
      return null;
    }

    const extractTurn = async (idx, retries = 0) => {
      await page.evaluate((i) => {
        const s = document.querySelectorAll('[data-testid^="conversation-turn-"]')[i];
        if (s) s.scrollIntoView({ behavior: "instant", block: "center" });
      }, idx);
      await sleep(500 + retries * 300);

      return page.evaluate((i) => {
        const s = document.querySelectorAll('[data-testid^="conversation-turn-"]')[i];
        if (!s) return null;
        const text = s.textContent?.trim() || "";
        const hasImg = s.querySelector('img') !== null;
        const label = text.length > 0 ? text.substring(0, 300) : (hasImg ? "[attachment]" : "[empty]");
        return {
          index: i + 1,
          role: s.getAttribute("data-turn") || "unknown",
          preview: label,
        };
      }, idx);
    };

    let first = await extractTurn(0);
    if (first && first.preview === "[empty]" && first.index < turnCount) {
      first = await extractTurn(0, 1);
    }

    const midIdx = Math.floor(turnCount / 2);
    let mid = await extractTurn(midIdx);
    if (mid && mid.preview === "[empty]" && midIdx + 1 < turnCount) {
      mid = await extractTurn(midIdx + 1, 1);
    }

    let last = await extractTurn(turnCount - 1);
    if (last && last.preview === "[empty]" && turnCount > 1) {
      last = await extractTurn(turnCount - 2, 1);
    }

    await browser.close();

    return {
      totalTurns: turnCount,
      firstTurn: first,
      midTurn: mid,
      lastTurn: last,
      scrapedAt: new Date().toISOString(),
    };
  } catch (e) {
    await browser.close();
    return { error: e.message };
  }
}

async function fullScrape(shareUrl) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox", "--disable-extensions"],
  });
  const page = await browser.newPage();
  const startTime = Date.now();

  try {
    await page.goto(shareUrl, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(4000);

    const turnCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid^="conversation-turn-"]').length
    );

    if (turnCount === 0) {
      await browser.close();
      return { turns: [], totalTurns: 0, error: "No turns found." };
    }

    const extracted = new Map();
    const STRIDE = 6;

    for (let i = 0; i < turnCount; i += STRIDE) {
      const target = Math.min(i + Math.floor(STRIDE / 2), turnCount - 1);
      await page.evaluate((idx) => {
        const s = document.querySelectorAll('[data-testid^="conversation-turn-"]')[idx];
        if (s) s.scrollIntoView({ behavior: "instant", block: "center" });
      }, target);
      await sleep(250);

      const batch = await page.evaluate(() => {
        const all = document.querySelectorAll('[data-testid^="conversation-turn-"]');
        const res = [];
        for (let j = 0; j < all.length; j++) {
          const s = all[j];
          const text = s.textContent?.trim() || "";
          const hasAttachment = s.querySelector('img, [data-testid*="image"], [data-testid*="file"]') !== null;
          res.push({
            index: j + 1,
            role: s.getAttribute("data-turn") || "unknown",
            content: text.length > 0 ? text : (hasAttachment ? "[attachment]" : "[empty]"),
            hasContent: text.length > 0,
          });
        }
        return res;
      });

      for (const t of batch) {
        if (!extracted.has(t.index) && (t.hasContent || t.content === "[attachment]")) {
          extracted.set(t.index, t);
        }
      }
    }

    const turns = [...extracted.values()].sort((a, b) => a.index - b.index);
    await browser.close();

    return {
      turns,
      totalTurns: turns.length,
      elapsedSeconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)),
      scrapedAt: new Date().toISOString(),
    };
  } catch (e) {
    await browser.close();
    throw e;
  }
}

function formatMarkdown(turns) {
  let md = "# ChatGPT Conversation Export\n\n*Pactis ChatGPT Exporter*\n\n---\n\n";
  for (const t of turns) {
    const rl = t.role === "assistant" ? "### Assistant" : "### User";
    md += `${rl} (Turn ${t.index})\n\n${t.content}\n\n---\n\n`;
  }
  return md;
}

const server = new McpServer({
  name: "pactis-chatgpt-exporter",
  version: "0.1.0",
  description: "Extract full conversation content from any public ChatGPT shared link. Built by Pactis.",
});

server.tool(
  "extract_chatgpt_share",
  "Extract the full conversation from a ChatGPT shared link. Returns complete chat history — all turns, roles, and content.",
  {
    url: z.string().url().describe("Full ChatGPT share URL, e.g. https://chatgpt.com/share/abc123..."),
    format: z.enum(["json", "markdown", "text"]).optional().default("json").describe("Output format: json, markdown, or text"),
  },
  async ({ url, format }) => {
    if (!url.includes("chatgpt.com/share/")) {
      return { content: [{ type: "text", text: "Error: Valid ChatGPT share URL required." }], isError: true };
    }

    const result = await fullScrape(url);
    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }

    switch (format) {
      case "markdown":
        return { content: [{ type: "text", text: formatMarkdown(result.turns) }] };
      case "text": {
        let txt = `ChatGPT Conversation Export\n${result.totalTurns} turns, ${result.elapsedSeconds}s\n\n`;
        for (const t of result.turns) {
          txt += `[${t.role.toUpperCase()}] Turn ${t.index}:\n${t.content}\n\n---\n\n`;
        }
        return { content: [{ type: "text", text: txt }] };
      }
      default:
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              totalTurns: result.totalTurns,
              elapsedSeconds: result.elapsedSeconds,
              scrapedAt: result.scrapedAt,
              turns: result.turns,
            }, null, 2),
          }],
        };
    }
  }
);

server.tool(
  "extract_chatgpt_summary",
  "Quick preview of a ChatGPT conversation — gets first, middle, and last turn without full extraction.",
  {
    url: z.string().url().describe("Full ChatGPT share URL"),
  },
  async ({ url }) => {
    if (!url.includes("chatgpt.com/share/")) {
      return { content: [{ type: "text", text: "Error: Valid ChatGPT share URL required." }], isError: true };
    }

    const summary = await quickSummary(url);
    if (!summary) {
      return { content: [{ type: "text", text: "Error: Could not extract summary." }], isError: true };
    }
    if (summary.error) {
      return { content: [{ type: "text", text: `Error: ${summary.error}` }], isError: true };
    }

    const parts = [`Total turns: ${summary.totalTurns}`];
    if (summary.firstTurn) parts.push(`First [${summary.firstTurn.role}] Turn ${summary.firstTurn.index}: ${summary.firstTurn.preview}`);
    if (summary.midTurn) parts.push(`Mid [${summary.midTurn.role}] Turn ${summary.midTurn.index}: ${summary.midTurn.preview}`);
    if (summary.lastTurn) parts.push(`Last [${summary.lastTurn.role}] Turn ${summary.lastTurn.index}: ${summary.lastTurn.preview}`);
    parts.push(`Scraped: ${summary.scrapedAt}`);

    return { content: [{ type: "text", text: parts.join("\n\n") }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
