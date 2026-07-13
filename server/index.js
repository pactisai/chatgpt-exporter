import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { scrapeChatGPT } from "../core/scraper.js";
import { enqueue, getJob } from "./queue.js";
import { getOgImage } from "./og-image.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DIST_DIR = path.join(__dirname, "..", "dist");

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/og-image.png", async (_req, res) => {
  try {
    const png = await getOgImage();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(png);
  } catch { res.status(500).end(); }
});

app.post("/api/jobs", (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes("chatgpt.com/share/")) {
    return res.status(400).json({ error: "Valid ChatGPT share URL required." });
  }
  res.json({ jobId: enqueue(url.trim()), status: "queued" });
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
  const send = (d) => res.write(`data: ${JSON.stringify(d)}\n\n`);
  try {
    const r = await scrapeChatGPT(url, send);
    send({ type: "done", ...r });
  } catch (e) {
    send({ type: "error", error: e.message });
  } finally {
    res.end();
  }
});

// Inject OG tags for root path
app.get("/", (req, res) => {
  const indexPath = path.join(DIST_DIR, "index.html");
  if (!fs.existsSync(indexPath)) return res.status(404).send("Not Found");
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const img = `${baseUrl}/og-image.png`;
  let html = fs.readFileSync(indexPath, "utf8");
  html = html.replace("</head>",
    `<meta property="og:title" content="ChatGPT Exporter by Pactis" />
    <meta property="og:description" content="Paste any ChatGPT share link — get the full conversation as Markdown, JSON, or plain text. Free tool by Pactis." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${baseUrl}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${img}" />
  </head>`);
  res.send(html);
});

app.use(express.static(DIST_DIR));

app.listen(PORT, () => console.log(`ChatGPT Exporter → :${PORT}`));
