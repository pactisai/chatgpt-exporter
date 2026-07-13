# ChatGPT Exporter

> **Live**: [chatgpt-exporter.up.railway.app](https://chatgpt-exporter.up.railway.app)

Paste any public ChatGPT share link. Get the full conversation as **Markdown, JSON, or plain text**. Web app + MCP server.

---

## Features

- **Instant extraction** via [chatgpt-share-parser](https://github.com/evanhu1/chatgpt-share-parser) (React Flight/turbo-stream parsing)
- **Playwright fallback** for resilient scraping
- **SSE streaming** progress
- **MCP server** — 2 tools for AI agents (Claude, Cursor, VS Code Copilot)
- **Job queue** + LRU cache
- **Rate limiting**, Helmet security headers, graceful shutdown

---

## Architecture

```
core/
├── scraper.js          # Primary: chatgpt-share-parser (instant)
│                       # Fallback: Playwright + browser pool
├── pool.js             # Headless Chromium singleton
├── blocker.js          # Resource blocking during Playwright scrape
└── validate.js         # URL validation (SSRF-proof)

server/
├── index.js            # Express 5 + helmet + rate limiter
├── queue.js            # Priority queue + LRU cache
└── og-image.js         # OG image generation (sharp)

mcp/
└── index.js            # MCP server (stdio transport, 2 tools)

client/
└── src/                # React 19 + Vite 8 + Tailwind 4
```

---

## Performance

| Conversation | chatgpt-share-parser | Playwright fallback |
|---|---|---|
| 20 turns | **<1s** | ~8s |
| 327 turns | **~1.5s** | ~40s |

---

## Quick Start

```bash
npm install
npm run build
npm start
# → http://localhost:3001
```

### Dev

```bash
npm run dev
# API: localhost:3001 | UI: localhost:5173
```

---

## MCP Server

Add to your MCP client config:

```json
{
  "mcpServers": {
    "chatgpt-exporter": {
      "command": "node",
      "args": ["/path/to/mcp/index.js"]
    }
  }
}
```

**Tools**: `extract_chatgpt_share` (full), `extract_chatgpt_summary` (preview)

---

## Deploy

### Railway (recommended)

1. Push to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Env var: `PORT=3001`

No Chromium needed — the fast path uses plain HTTP.

### Docker

```bash
docker build -t chatgpt-exporter .
docker run -p 3001:3001 chatgpt-exporter
```

---

## Credits

- Extraction engine: [evanhu1/chatgpt-share-parser](https://github.com/evanhu1/chatgpt-share-parser) (MIT) — ported from [vl3c/ChatPeek](https://github.com/vl3c/ChatPeek)
- Headless browser: [Playwright](https://playwright.dev)
- OG image: [sharp](https://sharp.pixelplumbing.com)

## License

MIT
