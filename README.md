# ChatGPT Exporter

Any ChatGPT share link → Markdown, JSON, or plain text.
Works as a **web app** and as an **MCP server** for AI agents.

---

## Architecture

```
chatgpt-exporter/
├── core/
│   └── scraper.js       # Shared scraping engine (Playwright)
├── server/
│   └── index.js          # Express web server (SSE streaming)
├── mcp/
│   └── index.js          # MCP server (stdio transport)
├── client/
│   └── src/              # React frontend (Vite + Tailwind)
└── package.json          # Runs both web + MCP
```

**`core/scraper.js`** is the single source of truth — both the web server and MCP server import from it.

---

## Web App

```bash
npm install && npx playwright install chromium
npm run build && npm start
# → http://localhost:3001
```

### Dev Mode

```bash
npm run dev
# API: localhost:3001 | UI: localhost:5173
```

---

## MCP Server (for AI Agents)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "chatgpt-exporter": {
      "command": "node",
      "args": ["/absolute/path/to/apps/chatgpt-exporter/mcp/index.js"]
    }
  }
}
```

### MCP Tools

| Tool | Description |
|---|---|
| `extract_chatgpt_share` | Full conversation extraction (JSON, Markdown, or text) |
| `extract_chatgpt_summary` | Fast preview — first turn + metadata only |

### Example MCP Call

```json
{
  "tool": "extract_chatgpt_share",
  "params": {
    "url": "https://chatgpt.com/share/abc123...",
    "format": "markdown"
  }
}
```

The MCP server uses **stdio transport** — compatible with Claude Desktop, Cursor, VS Code Copilot, and any MCP-compatible client.

### Debug MCP

```bash
npm run mcp:inspect
# Opens MCP Inspector in browser to test tools interactively
```

---

## Deploy (Web App Only)

> Serverless (Vercel/Netlify) won't work — Playwright requires headless Chromium.

| Platform | Ease |
|---|---|
| **Railway** | Easiest — GitHub push, set root dir, deploy |
| **Render** | Easy — Web Service, free tier available |
| **Fly.io** | Medium — `fly deploy` via Dockerfile |
| **Docker + VPS** | Medium — docker build && docker run |

Dockerfile included. See the full deployment section above.

---

## Tech

- **Scraper**: Playwright + headless Chromium
- **Web Backend**: Express 5 (SSE streaming)
- **MCP Backend**: `@modelcontextprotocol/sdk` (stdio transport)
- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4
