import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { scrapeChatGPT } from "../core/scraper.js";
import { enqueue, getJob } from "./queue.js";
import { ogMiddleware } from "./og-middleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DIST_DIR = path.join(__dirname, "..", "dist");

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", distExists: fs.existsSync(path.join(DIST_DIR, "index.html")) });
});

app.post("/api/jobs", (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes("chatgpt.com/share/")) {
    return res.status(400).json({ error: "Valid ChatGPT share URL required." });
  }
  const jobId = enqueue(url.trim());
  res.json({ jobId, status: "queued" });
});

app.get("/api/jobs/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes("chatgpt.com/share/")) {
    return res.status(400).json({ error: "Valid ChatGPT share URL required." });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  try {
    const result = await scrapeChatGPT(url, send);
    send({ type: "done", ...result });
  } catch (e) {
    send({ type: "error", error: e.message });
  } finally {
    res.end();
  }
});

app.use(express.static(DIST_DIR));

app.use((req, res) => {
  const indexPath = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const originalHtml = fs.readFileSync(indexPath, "utf8");
    const scriptsMatch = originalHtml.match(/src="(\/assets\/[^"]+)"/);
    const cssMatch = originalHtml.match(/href="(\/assets\/[^"]+)"/);
    const injected = originalHtml
      .replace(/<meta property="og:image" content="[^"]*"[^>]*>/g, "")
      .replace("</head>", `<meta property="og:title" content="ChatGPT Exporter by Pactis" />
    <meta property="og:description" content="Paste any ChatGPT share link — get the full conversation as Markdown, JSON, or plain text." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Pactis" />
    <meta property="og:url" content="${baseUrl}" />
    <meta property="og:image" content="${baseUrl}/og-image.svg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/svg+xml" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="ChatGPT Exporter by Pactis" />
    <meta name="twitter:description" content="Paste any ChatGPT share link — get the full conversation." />
    <meta name="twitter:image" content="${baseUrl}/og-image.svg" />
  </head>`);
    res.send(injected);
  } else {
    res.status(404).send("Not Found");
  }
});

app.listen(PORT, () => {
  console.log(`ChatGPT Exporter → :${PORT}`);
});
