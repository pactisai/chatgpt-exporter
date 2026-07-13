import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { scrapeChatGPT } from "../core/scraper.js";
import { closePool } from "../core/pool.js";
import { isValidShareUrl } from "../core/validate.js";

const server = new McpServer({
  name: "pactis-chatgpt-exporter",
  version: "0.2.0",
  description: "Extract full conversation content from any public ChatGPT shared link. Instant extraction via chatgpt-share-parser.",
});

server.tool(
  "extract_chatgpt_share",
  "Extract full conversation from a ChatGPT shared link. Returns all turns, roles, content, and assets. Outputs JSON, Markdown, or plain text.",
  {
    url: z.string().url().describe("Full ChatGPT share URL"),
    format: z.enum(["json", "markdown", "text"]).optional().default("json").describe("Output format"),
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

server.tool(
  "extract_chatgpt_summary",
  "Quick preview of a ChatGPT conversation — first, middle, and last turn.",
  {
    url: z.string().url().describe("Full ChatGPT share URL"),
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
await server.connect(transport);

process.on("SIGINT", async () => { await closePool(); process.exit(0); });
process.on("SIGTERM", async () => { await closePool(); process.exit(0); });
