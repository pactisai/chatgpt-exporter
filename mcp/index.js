import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { scrapeChatGPT } from "../core/scraper.js";
import { closePool } from "../core/pool.js";
import { isValidShareUrl } from "../core/validate.js";

const server = new McpServer({
  name: "pactis-chatgpt-exporter",
  version: "0.3.0",
  description: "Extract full conversation content from any public ChatGPT shared link. Instant extraction via chatgpt-share-parser.",
  capabilities: {
    tools: { listChanged: true },
  },
});

/*
 * outputSchema:
 * - json: { totalTurns, elapsedSeconds, method, scrapedAt, turns: [{ role, content, assets }] }
 * - markdown: string with headers per turn
 * - text: raw plain text of all turns
 */
server.tool(
  "extract_chatgpt_share",
  "Extract ALL conversation turns from a public ChatGPT share link. Use this when you need the complete conversation content. Input: a full ChatGPT share URL (e.g., https://chatgpt.com/share/abc123). Output: all turns with role (user/assistant), content, and any assets (images). You can choose output format: json (structured), markdown (with headers), or text (plain).",
  {
    url: z.string().url().describe("Full ChatGPT share URL"),
    format: z.enum(["json", "markdown", "text"]).optional().default("json").describe("Output format"),
  },
  {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ url, format }) => {
    if (!isValidShareUrl(url)) {
      return { content: [{ type: "text", text: "Error: Valid ChatGPT share URL required." }], isError: true };
    }
    const result = await scrapeChatGPT(url);
    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }
    switch (format) {
      case "markdown": return { content: [{ type: "text", text: result.markdown }] };
      case "text":    return { content: [{ type: "text", text: result.plainText }] };
      default:        return { content: [{ type: "text", text: JSON.stringify({
        totalTurns: result.totalTurns, elapsedSeconds: result.elapsedSeconds,
        method: result.method, scrapedAt: result.scrapedAt, turns: result.turns,
      }, null, 2) }] };
    }
  }
);

/*
 * outputSchema:
 * - { totalTurns, elapsedSeconds, method, first: { role, preview }, mid: { role, preview }, last: { role, preview } }
 * Each preview is the first 500 characters of the turn content.
 */
server.tool(
  "extract_chatgpt_summary",
  "Get a QUICK PREVIEW of a ChatGPT conversation. Use this when you only need to see the first, middle, and last turn — for example, to decide if the full conversation is worth extracting. Much faster than full extraction for long conversations. Input: a full ChatGPT share URL.",
  {
    url: z.string().url().describe("Full ChatGPT share URL"),
  },
  {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ url }) => {
    if (!isValidShareUrl(url)) {
      return { content: [{ type: "text", text: "Error: Valid ChatGPT share URL required." }], isError: true };
    }
    const result = await scrapeChatGPT(url);
    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }
    const turns = result.turns;
    const mid = Math.floor(turns.length / 2);
    return { content: [{ type: "text", text: JSON.stringify({
      totalTurns: result.totalTurns, elapsedSeconds: result.elapsedSeconds,
      method: result.method,
      first: turns[0] ? { role: turns[0].role, preview: turns[0].content.substring(0, 500) } : null,
      mid: turns[mid] ? { role: turns[mid].role, preview: turns[mid].content.substring(0, 500) } : null,
      last: turns[turns.length-1] ? { role: turns[turns.length-1].role, preview: turns[turns.length-1].content.substring(0, 500) } : null,
    }, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
console.error("[mcp] Connecting to transport...");
await server.connect(transport);
console.error("[mcp] Connected. Tools: extract_chatgpt_share, extract_chatgpt_summary");

process.on("SIGINT", async () => { await closePool(); process.exit(0); });
process.on("SIGTERM", async () => { await closePool(); process.exit(0); });
