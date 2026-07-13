# ChatGPT Exporter

> **Live**: [chatgpt-exporter.up.railway.app](https://chatgpt-exporter.up.railway.app)

Paste any public ChatGPT share link. Get the full conversation as **Markdown, JSON, or plain text**. Web app + MCP server.

---

## Features

- **Instant extraction** via vendored chatgpt-share-parser (React Flight/turbo-stream parsing)
- **Playwright fallback** for resilient scraping
- **Circuit breaker** — auto-skips fast-path after 3 failures, prevents cascading timeouts
- **SSRF protection** — 4-layer defense (protocol → hostname → private IP → domain allowlist)
- **CSP security headers** — 12-directive Content-Security-Policy enabled
- **SSE streaming** progress
- **MCP server v0.3.0** — 2 tools with LLM-optimized descriptions + annotations
- **Job queue** + LRU cache (p-queue, 200 items, 1hr TTL)
- **Rate limiting** (trust proxy), Helmet security headers, input validation, graceful shutdown

---

## Architecture

```
core/
├── parser/                   # Vendored chatgpt-share-parser
│   ├── vendor.js             #   Original parser source
│   ├── index.js              #   Timeout wrapper + retry + telemetry
│   └── circuit-breaker.js    #   3-failure → 60s cooldown
├── extractors/
│   ├── fast-path.js          #   Primary: instant parser extraction
│   └── playwright-fallback.js#   Fallback: headless browser scraping
├── formatters.js             #   Markdown + plain text output
├── scraper.js                #   Thin orchestrator (23 lines)
├── pool.js                   #   Headless Chromium singleton
├── blocker.js                #   Resource blocking during Playwright scrape
└── validate.js               #   4-layer URL validation + SSRF protection

server/
├── index.js                  # Express 5 config + middleware + lifecycle
├── routes/
│   ├── health.js             #   GET /api/health
│   ├── stats.js              #   GET /api/stats
│   ├── jobs.js               #   POST /api/jobs + GET /api/jobs/:id
│   ├── scrape.js             #   POST /api/scrape (SSE)
│   └── og-image.js           #   GET /og-image.png
├── queue.js                  # Priority queue + LRU cache
├── metrics.js                # In-memory telemetry
└── og-image.js               # OG image generation (sharp)

mcp/
└── index.js                  # MCP server v0.3.0 (stdio, 2 tools, annotations)

client/src/
├── App.tsx                   # Thin orchestrator (198 lines)
├── types.ts                  # Shared TypeScript interfaces
├── hooks/
│   └── useScrapeJob.ts       # Job submission + polling logic
└── components/
    ├── URLInput.tsx           #   URL input + rotating placeholders
    ├── ProgressIndicator.tsx  #   Animated spinner + progress bar
    ├── ErrorDisplay.tsx       #   Error state
    ├── StatsGrid.tsx          #   Turns, duration, size, words
    ├── DownloadButtons.tsx    #   Markdown / JSON / Text download
    ├── PreviewTerminal.tsx    #   Truncated content preview
    ├── IdlePrompt.tsx         #   Empty state
    └── Logo.tsx               #   PactisLogo SVG
```

---

## Performance

| Conversation | chatgpt-share-parser | Playwright fallback |
|---|---|---|
| 20 turns | **<1s** | ~8s |
| 327 turns | **~1.5s** | ~40s |

### API Response Times (warm)

| Endpoint | Before | After | Gain |
|---|---|---|---|
| `GET /api/health` | 3ms | **1.5ms** | 2x |
| `POST /api/jobs` | 17ms | **2ms** | 8.5x |
| SSRF block | 6ms | **2ms** | 3x |

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

### Test

```bash
npm test              # 166 unit + integration tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E tests
npm run test:all      # All tests + coverage
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

| Capability | Detail |
|---|---|
| Version | 0.3.0 |
| Transport | stdio |
| Annotations | readOnlyHint, idempotentHint, etc. |
| listChanged | true |

---

## Deploy

### Railway (recommended)

1. Push to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Env var: `PORT=3001`

Fast-path only — no Chromium needed.

### Docker

```bash
# Slim (fast-path only, ~150MB)
docker build --target slim -t chatgpt-exporter .
docker run -p 3001:3001 chatgpt-exporter

# Full (with Chromium fallback, ~450MB)
docker build --target full -t chatgpt-exporter:full .
```

### CI/CD

GitHub Actions runs on every push/PR:
- `test` — `npm ci` → `npm test` → `npm run build`
- `security` — `npm audit --audit-level=high`

---

## Security

| Layer | Detail |
|---|---|
| **CSP** | 12-directive Content-Security-Policy |
| **SSRF** | Protocol → hostname → private IP → domain allowlist |
| **Rate limit** | 30 req/min, trust proxy for Railway/nginx |
| **Input** | 2048-char URL limit, 10kb JSON body |
| **HSTS** | 365d (prod), disabled in dev |
| **Parser risk** | Vendored + circuit breaker + 2-layer tests |

---

## Credits

- Extraction engine: [evanhu1/chatgpt-share-parser](https://github.com/evanhu1/chatgpt-share-parser) (MIT) — ported from [vl3c/ChatPeek](https://github.com/vl3c/ChatPeek)
- Headless browser: [Playwright](https://playwright.dev)
- OG image: [sharp](https://sharp.pixelplumbing.com)

## License

MIT
