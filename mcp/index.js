import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { scrapeChatGPT, formatMarkdown, formatText } from "../core/scraper.js";

const server = new McpServer({
  name: "pactis-chatgpt-exporter",
  version: "0.1.0",
  description: "Extract full conversation content from any public ChatGPT shared link. Built by Pactis.",
});

server.tool(
  "extract_chatgpt_share",
  "Extract the full conversation from a ChatGPT shared link. Returns complete chat history — all turns, roles, and content. Supports JSON, Markdown, or plain text output.",
  {
    url: z.string().url().describe("Full ChatGPT share URL, e.g. https://chatgpt.com/share/abc123..."),
    format: z
      .enum(["json", "markdown", "text"])
      .optional()
      .default("json")
      .describe("Output format: json (structured), markdown (.md), or text (.txt)"),
  },
  async ({ url, format }) => {
    if (!url.includes("chatgpt.com/share/")) {
      return {
        content: [{ type: "text", text: "Error: Must be a valid ChatGPT share URL (chatgpt.com/share/...)" }],
        isError: true,
      };
    }
    const result = await scrapeChatGPT(url);
    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }
    switch (format) {
      case "markdown":
        return { content: [{ type: "text", text: result.markdown }] };
      case "text":
        return { content: [{ type: "text", text: result.plainText }] };
      default:
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ totalTurns: result.totalTurns, elapsedSeconds: result.elapsedSeconds, turns: result.turns }, null, 2),
          }],
        };
    }
  }
);

server.tool(
  "extract_chatgpt_summary",
  "Get a quick summary + first/last turn preview from a ChatGPT share link (faster than full extraction).",
  {
    url: z.string().url().describe("Full ChatGPT share URL"),
  },
  async ({ url }) => {
    if (!url.includes("chatgpt.com/share/")) {
      return { content: [{ type: "text", text: "Error: Must be a valid ChatGPT share URL." }], isError: true };
    }
    const result = await scrapeChatGPT(url);
    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }
    const summary = {
      totalTurns: result.totalTurns,
      duration: `${result.elapsedSeconds}s`,
      firstTurn: result.turns[0] ? { role: result.turns[0].role, preview: result.turns[0].content.substring(0, 500) } : null,
      lastTurn: result.turns[result.turns.length - 1] ? { role: result.turns[result.turns.length - 1].role, preview: result.turns[result.turns.length - 1].content.substring(0, 500) } : null,
      scrapedAt: result.scrapedAt,
    };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
